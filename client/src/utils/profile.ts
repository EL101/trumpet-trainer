import type { User } from "firebase/auth";
import type { Profile } from "@/schema";
import { authedFetch } from "./api";

export async function fetchProfile(user: User | undefined | null, signal?: AbortSignal) {
  const res = await authedFetch("/api/profile", user, { signal });
  return res ? ((await res.json()) as Profile) : null;
}

/** Re-mirror the signed-in user's profile fields from their token claims. */
export async function syncProfile(user: User | undefined | null) {
  await authedFetch("/api/profile/sync", user, { method: "POST" });
}

/** Replace the avatar. `dataUrl` comes from fileToAvatarDataUrl. */
export async function uploadAvatar(user: User | undefined | null, dataUrl: string) {
  const res = await authedFetch("/api/profile/avatar", user, {
    method: "PUT",
    body: JSON.stringify({ dataUrl }),
  });
  return res ? ((await res.json()) as { avatarUrl: string; hasUpload: boolean }) : null;
}

/** Drop the uploaded avatar, reverting to the provider photo or initials. */
export async function removeAvatar(user: User | undefined | null) {
  await authedFetch("/api/profile/avatar", user, { method: "DELETE" });
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

/** Delete a guest account and its exercises. Counterpart to mergeGuestData. */
export async function discardGuestData(user: User | undefined | null, guestToken: string) {
  await authedFetch("/api/profile/discard-guest", user, {
    method: "POST",
    body: JSON.stringify({ guestToken }),
  });
}

/** How many generated and saved exercises the user has. */
export async function countExercises(user: User | undefined | null) {
  const [history, library] = await Promise.all(
    ["/api/history", "/api/library"].map(async (path) => {
      const res = await authedFetch(path, user);
      return res ? ((await res.json()) as unknown[]).length : 0;
    }),
  );
  return { history, library };
}
