import type { User } from "firebase/auth";
import { authedFetch } from "./api";

/** Re-mirror the signed-in user's profile fields from their token claims. */
export async function syncProfile(user: User | undefined | null) {
  await authedFetch("/api/profile/sync", user, { method: "POST" });
}

/**
 * Move a guest account's exercises onto the signed-in account.
 * `guestToken` is the guest's ID token, captured before the sign-in that
 * replaced them.
 */
export async function mergeGuestData(user: User | undefined | null, guestToken: string) {
  const res = await authedFetch("/api/profile/merge-guest", user, {
    method: "POST",
    body: JSON.stringify({ guestToken }),
  });
  return res ? ((await res.json()) as { history: number; library: number }) : null;
}
