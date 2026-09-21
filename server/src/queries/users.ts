import type admin from "firebase-admin";
import { prisma } from "../db.js";

/**
 * uids known to have a row already. Only guards against redundant INSERTs, so a
 * stale entry can't go wrong: the row it refers to is never deleted while the
 * user is signed in. Bounded by the number of distinct users per process boot.
 */
const ensured = new Set<string>();

/**
 * Create the user's row if it is missing, seeded from their ID token claims.
 *
 * `history` and `library` carry a foreign key to `users`, so this has to run
 * before any write. `createMany` compiles to INSERT ... ON CONFLICT DO NOTHING,
 * which — unlike `upsert` — can't collide when a user's first two requests
 * arrive at once.
 *
 * Existence only; GET /api/profile is what refreshes email/displayName.
 */
export async function ensureUserExists(claims: admin.auth.DecodedIdToken) {
  if (ensured.has(claims.uid)) return;

  await prisma.user.createMany({
    data: {
      id: claims.uid,
      email: claims.email ?? null,
      displayName: claims.name ?? null,
      isAnonymous: claims.firebase?.sign_in_provider === "anonymous",
    },
    skipDuplicates: true,
  });

  ensured.add(claims.uid);
}
