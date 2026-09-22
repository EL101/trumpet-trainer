import admin from "firebase-admin";
import { prisma } from "../db.js";

/** A guest untouched for this long is considered abandoned. */
export const GUEST_TTL_MS = 24 * 60 * 60 * 1000;

/** How stale lastSeenAt may get before the next request refreshes it. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

/** Stop paging Firebase after this many users, so one sweep can't run away. */
const SWEEP_MAX_USERS = 10_000;

/** deleteUsers() takes at most 1000 uids per call. */
const DELETE_BATCH = 1000;

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
  await prisma.user.updateMany({ where: { id: claims.uid }, data: { lastSeenAt } });

  rememberTouch(claims.uid, now);
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
 * Delete anonymous users that have been idle for longer than the TTL, from both
 * Firebase Auth and Postgres.
 *
 * Candidates come from Firebase rather than from `users`, so a guest who signed
 * in but never reached the API -- and therefore has no row -- is still cleaned up.
 */
export async function sweepAbandonedGuests(now = Date.now()) {
  const cutoff = new Date(now - GUEST_TTL_MS);
  const candidates: string[] = [];

  let pageToken: string | undefined;
  let scanned = 0;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) {
      // An anonymous user is one with no linked identity provider. A guest who
      // has since linked Google has providerData, so they are skipped here.
      if (user.providerData.length > 0) continue;
      if (new Date(user.metadata.creationTime) >= cutoff) continue;
      candidates.push(user.uid);
    }
    scanned += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken && scanned < SWEEP_MAX_USERS);

  if (candidates.length === 0) return { deleted: 0, scanned };

  // Creation time only says the account is old. Keep anyone still using it.
  const active = await prisma.user.findMany({
    where: { id: { in: candidates }, lastSeenAt: { gte: cutoff } },
    select: { id: true },
  });
  const activeUids = new Set(active.map((row) => row.id));
  const doomed = candidates.filter((uid) => !activeUids.has(uid));
  if (doomed.length === 0) return { deleted: 0, scanned };

  // Postgres first. If the Firebase delete then fails, the next sweep still
  // finds the account (candidates come from Firebase) and retries. Doing it the
  // other way round would strand the Postgres row where no sweep looks again.
  await prisma.user.deleteMany({ where: { id: { in: doomed } } });

  let deleted = 0;
  for (let i = 0; i < doomed.length; i += DELETE_BATCH) {
    const batch = doomed.slice(i, i + DELETE_BATCH);
    const result = await admin.auth().deleteUsers(batch);
    deleted += result.successCount;
    for (const err of result.errors) {
      console.error(`Guest sweep: failed to delete ${batch[err.index]}:`, err.error.message);
    }
  }

  for (const uid of doomed) touched.delete(uid);
  return { deleted, scanned };
}
