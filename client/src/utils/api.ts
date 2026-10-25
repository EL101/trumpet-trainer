import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL;

/** A non-2xx response, with its status and its JSON body when it had one. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * fetch() against the API with the caller's Firebase ID token attached.
 * Returns null when there is no signed-in user, and throws an ApiError on a non-2xx
 * response.
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
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(`${init.method ?? "GET"} ${path} failed: ${res.status}`, res.status, body);
  }
  return res;
}
