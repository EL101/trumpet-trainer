import { vi } from "vitest";
import type { auth as adminAuth } from "firebase-admin";

export type Claims = Partial<adminAuth.DecodedIdToken> & { uid: string };

/** Fake ID tokens: each one maps to the claims verifyIdToken should return. */
const tokens = new Map<string, Claims>();

export const auth = {
  verifyIdToken: vi.fn(),
  getUsers: vi.fn(),
  deleteUsers: vi.fn(),
  deleteUser: vi.fn(),
};

export const admin = {
  auth: () => auth,
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
};

/** A Firebase error with a code, the way firebase-admin throws them. */
export function firebaseError(code: string) {
  return Object.assign(new Error(code), { code });
}

export function resetFirebase() {
  tokens.clear();
  auth.verifyIdToken.mockReset().mockImplementation(async (token: string) => {
    const claims = tokens.get(token);
    if (!claims) throw firebaseError("auth/argument-error");
    return claims;
  });
  // By default every uid asked about exists and is still a guest.
  auth.getUsers.mockReset().mockImplementation(async (ids: { uid: string }[]) => ({
    users: ids.map(({ uid }) => ({ uid, providerData: [] })),
    notFound: [],
  }));
  auth.deleteUsers.mockReset().mockImplementation(async (uids: string[]) => ({
    successCount: uids.length,
    failureCount: 0,
    errors: [],
  }));
  auth.deleteUser.mockReset().mockResolvedValue(undefined);
}

/** Issue a token that verifies as `claims`. */
export function tokenFor(claims: Claims): string {
  const token = `token-${tokens.size}-${claims.uid}`;
  tokens.set(token, claims);
  return token;
}

export const guestClaims = (uid: string): Claims => ({
  uid,
  firebase: { sign_in_provider: "anonymous", identities: {} },
});

export const googleClaims = (uid: string, extra: Partial<Claims> = {}): Claims => ({
  uid,
  email: `${uid}@example.com`,
  name: `User ${uid}`,
  firebase: { sign_in_provider: "google.com", identities: {} },
  ...extra,
});
