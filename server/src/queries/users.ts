import admin from "firebase-admin";
import { prisma } from "../db.js";

/** A guest untouched for this long is considered abandoned. */
export const GUEST_TTL_MS = 48 * 60 * 60 * 1000;

/** How stale lastSeenAt may get before the next request refreshes it. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

/** Guests checked per round trip. getUsers() takes at most 100 identifiers. */
const SWEEP_BATCH = 100;

/**
 * uid -> when we last wrote lastSeenAt for it. Purely an optimisation: a missing
 * or stale entry costs one redundant write, never a wrong result.
 */
const touched = new Map<string, number>();

function rememberTouch(uid: string, now: number) {
  // Entries older than the throttle window are dead weight; drop them in bulk
  // rather than tracking every uid this process has ever seen.
  if (touched.size > 10_000) {
    for (const [key, at] of touched) {
      if (now - at >= LAST_SEEN_THROTTLE_MS) touched.delete(key);
    }
  }
  touched.set(uid, now);
}

/**
 * Create the user's row if missing and keep lastSeenAt current.
 *
 * `history` and `library` carry a foreign key to `users`, so this has to run
 * before any write. Throttled per process, so a busy user costs two statements
 * an hour rather than two per request.
 *
 * createMany compiles to INSERT ... ON CONFLICT DO NOTHING and updateMany is a
 * no-op on a missing row, so neither can fail when a user's first two requests
 * arrive at once -- which `upsert` would, with P2002.
 *
 * Existence and liveness only; POST /api/profile/sync refreshes email/displayName.
 */
export async function ensureUserExists(claims: admin.auth.DecodedIdToken) {
  const now = Date.now();
  const last = touched.get(claims.uid);
  if (last !== undefined && now - last < LAST_SEEN_THROTTLE_MS) return;

  const lastSeenAt = new Date(now);
  await prisma.user.createMany({
    data: {
      id: claims.uid,
      email: claims.email ?? null,
      displayName: claims.name ?? null,
      isAnonymous: claims.firebase?.sign_in_provider === "anonymous",
      lastSeenAt,
    },
    skipDuplicates: true,
  });
  // Also correct isAnonymous: a guest who links Google keeps their uid, so the
  // row above already exists and createMany leaves its stale value alone.
  await prisma.user.updateMany({
    where: { id: claims.uid },
    data: { lastSeenAt, isAnonymous: claims.firebase?.sign_in_provider === "anonymous" },
  });

  rememberTouch(claims.uid, now);
}

/** The user row plus their avatar, for GET /api/profile. */
export function getUserWithAvatar(uid: string) {
  return prisma.user.findUnique({ where: { id: uid }, include: { avatar: true } });
}

/** Refresh the mirrored profile fields from the caller's current token claims. */
export async function syncUserFromClaims(claims: admin.auth.DecodedIdToken) {
  const isAnonymous = claims.firebase?.sign_in_provider === "anonymous";
  const lastSeenAt = new Date();

  await prisma.user.createMany({
    data: {
      id: claims.uid,
      email: claims.email ?? null,
      displayName: claims.name ?? null,
      isAnonymous,
      lastSeenAt,
    },
    skipDuplicates: true,
  });
  return prisma.user.update({
    where: { id: claims.uid },
    data: {
      email: claims.email ?? null,
      displayName: claims.name ?? null,
      isAnonymous,
      lastSeenAt,
    },
  });
}

/**
 * Move everything a guest owns onto the account they just signed in as, then
 * drop the guest row.
 *
 * Only needed when linkWithPopup can't upgrade the anonymous account in place
 * because the Google credential already belongs to another user. The happy path
 * keeps the same uid and needs none of this.
 */
export async function mergeGuestData(guestUid: string, targetUid: string) {
  return prisma.$transaction(async (tx) => {
    // Both users' generation numbers start at 1, and the client keys history by
    // generationNum -- so without an offset the guest's rows would silently
    // overwrite the target's in the UI.
    const [history, library] = await Promise.all([
      tx.history.aggregate({ where: { userId: targetUid }, _max: { generationNum: true } }),
      tx.library.aggregate({ where: { userId: targetUid }, _max: { generationNum: true } }),
    ]);

    const moved = {
      history: await tx.history.updateMany({
        where: { userId: guestUid },
        data: {
          userId: targetUid,
          generationNum: { increment: history._max.generationNum ?? 0 },
        },
      }),
      library: await tx.library.updateMany({
        where: { userId: guestUid },
        data: {
          userId: targetUid,
          generationNum: { increment: library._max.generationNum ?? 0 },
        },
      }),
    };

    // Only adopt the guest's avatar if the account doesn't already have one.
    const existing = await tx.userAvatar.findUnique({ where: { userId: targetUid } });
    if (!existing) {
      await tx.userAvatar.updateMany({ where: { userId: guestUid }, data: { userId: targetUid } });
    }

    // Must come last: users -> history/library/user_avatars cascades on delete,
    // so deleting first would destroy the rows we just reassigned.
    await tx.user.deleteMany({ where: { id: guestUid } });

    return { history: moved.history.count, library: moved.library.count };
  });
}

/**
 * Delete a guest's row; history, library and avatar go with it by cascade.
 * Scoped to anonymous rows so a mistaken uid can never wipe a real account.
 */
export async function discardGuest(guestUid: string) {
  await prisma.user.deleteMany({ where: { id: guestUid, isAnonymous: true } });
  touched.delete(guestUid);
}

/**
 * Delete guests idle for longer than the TTL, from both Postgres and Firebase.
 *
 * Candidates come from Postgres -- anonymous rows with a stale lastSeenAt, which
 * idx_users_anonymous_last_seen serves directly -- so the cost scales with the
 * number of abandoned guests, not with every account in Firebase.
 *
 * Firebase is still the authority on whether an account is a guest. A guest who
 * linked Google keeps their uid, and if the follow-up /sync failed their row
 * still says isAnonymous. Each candidate is checked against Firebase first, and
 * any that turn out to be linked get their row corrected instead of deleted.
 *
 * Not covered: a guest whose Firebase account has no row at all (signed in but
 * never reached the API). They own nothing here, so they cost no space.
 */
export async function sweepAbandonedGuests(now = Date.now()) {
  const cutoff = new Date(now - GUEST_TTL_MS);
  const stale = { isAnonymous: true, lastSeenAt: { lt: cutoff } };
  let deleted = 0;
  let scanned = 0;

  // Keyset pagination on id rather than re-querying from the top: a guest whose
  // Firebase delete fails stays a candidate, and must not be fetched forever.
  let after = "";
  for (;;) {
    const batch = await prisma.user.findMany({
      where: { ...stale, id: { gt: after } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: SWEEP_BATCH,
    });
    if (batch.length === 0) break;
    after = batch[batch.length - 1].id;
    scanned += batch.length;

    const uids = batch.map((row) => row.id);
    const { users } = await admin.auth().getUsers(uids.map((uid) => ({ uid })));

    // An anonymous user is one with no linked identity provider.
    const linked = users.filter((user) => user.providerData.length > 0).map((user) => user.uid);
    if (linked.length > 0) {
      await prisma.user.updateMany({ where: { id: { in: linked } }, data: { isAnonymous: false } });
    }

    // Uids Firebase doesn't know are doomed too: their row is all that's left.
    const linkedSet = new Set(linked);
    const doomed = uids.filter((uid) => !linkedSet.has(uid));
    if (doomed.length === 0) continue;

    // Firebase first. If the row delete then fails, the row is still a candidate
    // next time, and deleting an already-deleted Firebase user is a no-op. The
    // other order would strand Firebase accounts that no Postgres scan can find.
    const result = await admin.auth().deleteUsers(doomed);
    const failed = new Set<string>();
    for (const err of result.errors) {
      failed.add(doomed[err.index]);
      console.error(`Guest sweep: failed to delete ${doomed[err.index]}:`, err.error.message);
    }

    // Re-check staleness so a guest who came back mid-sweep keeps their row.
    const removed = await prisma.user.deleteMany({
      where: { ...stale, id: { in: doomed.filter((uid) => !failed.has(uid)) } },
    });
    deleted += removed.count;
    for (const uid of doomed) touched.delete(uid);

    if (batch.length < SWEEP_BATCH) break;
  }

  return { deleted, scanned };
}
