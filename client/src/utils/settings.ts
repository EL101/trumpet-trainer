import type { User } from "firebase/auth";
import type { Settings } from "@/schema";
import { authedFetch } from "./api";

/** The user's settings: their own, or the defaults if they've never saved any. */
export async function fetchSettings(user: User | undefined | null, signal?: AbortSignal) {
  const res = await authedFetch("/api/settings", user, { signal });
  return res ? ((await res.json()) as Settings) : null;
}

/** Replace the user's settings, all at once. Resolves to what the server saved. */
export async function saveSettings(user: User | undefined | null, settings: Settings) {
  const res = await authedFetch("/api/settings", user, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  return res ? ((await res.json()) as Settings) : null;
}
