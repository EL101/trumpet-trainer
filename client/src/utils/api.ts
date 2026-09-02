import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * fetch() against the API with the caller's Firebase ID token attached.
 * Returns null when there is no signed-in user, and throws on a non-2xx response.
 */
export async function authedFetch(
  path: string,
  user: User | undefined | null,
  init: RequestInit = {},
): Promise<Response | null> {
  if (!user) return null;

  const token = await user.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return res;
}
