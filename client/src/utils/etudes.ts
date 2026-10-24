import type { User } from "firebase/auth";
import type { Difficulty, Key, MusicInfo, Range } from "@/schema";
import { ApiError, authedFetch } from "./api";

/** Etudes left in the user's rolling 24 hours. Mirrors the server's QuotaStatus. */
export type EtudeQuota = {
  limit: number;
  remaining: number;
  /** When the oldest etude counted leaves the window, freeing one; null if none are counted. */
  resetsAt: string | null;
};

/**
 * An etude request, which the server works on in the background. Once it has
 * SUCCEEDED, `exercise` is the history entry it was saved as (null if history has
 * since been cleared); once it has FAILED, `error` says why. Mirrors the server's
 * EtudeView.
 */
export type EtudeJob = {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  error: string | null;
  exercise: MusicInfo | null;
};

/** What an etude is asked for. Mirrors the body of the server's POST /api/etudes. */
export type EtudeRequest = {
  musicKey: Key;
  timeSig: string;
  measures: number;
  noteRange: Range;
  difficulty: Difficulty;
};

/**
 * How asking for an etude went. Started means the server is writing it; `job` is
 * also set when it refused because another is already being written, which is
 * then the one to wait for.
 */
export type EtudeStart =
  | { ok: true; job: EtudeJob; quota: EtudeQuota }
  | { ok: false; message: string; job?: EtudeJob; quota?: EtudeQuota };

const OFFLINE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const FAILED_MESSAGE = "Couldn't start an etude this time. Try again.";
const GONE_MESSAGE = "That etude can't be found any more. Try generating another.";

/**
 * Ask the server to write an etude. Never throws: a refusal comes back with the
 * message to show, which the server words for the player.
 */
export async function startEtude(
  user: User | undefined | null,
  request: EtudeRequest,
): Promise<EtudeStart> {
  try {
    const res = await authedFetch("/api/etudes", user, {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!res) return { ok: false, message: "Sign in to generate etudes." };
    const { etude, quota }: { etude: EtudeJob; quota: EtudeQuota } = await res.json();
    return { ok: true, job: etude, quota };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = (error.body ?? {}) as { error?: unknown; etude?: EtudeJob; quota?: EtudeQuota };
      const message = typeof body.error === "string" ? body.error : FAILED_MESSAGE;
      return { ok: false, message, job: body.etude, quota: body.quota };
    }
    console.error("start etude error:", error);
    return { ok: false, message: OFFLINE_MESSAGE };
  }
}

/**
 * How an etude request is getting on, or null if that couldn't be found out just
 * now (worth asking again). A request the server doesn't know comes back failed,
 * so nothing waits on it for ever.
 */
export async function fetchEtude(
  user: User | undefined | null,
  id: string,
  signal?: AbortSignal,
): Promise<{ etude: EtudeJob; quota?: EtudeQuota } | null> {
  try {
    const res = await authedFetch(`/api/etudes/${id}`, user, { signal });
    return res ? await res.json() : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { etude: { id, status: "FAILED", error: GONE_MESSAGE, exercise: null } };
    }
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.error("fetch etude error:", error);
    }
    return null;
  }
}

/**
 * The user's etude quota, and the etude being written for them if there is one,
 * so a page opened mid-etude can wait for it. Null if it couldn't be loaded.
 */
export async function fetchEtudeStatus(
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<(EtudeQuota & { pending: EtudeJob | null }) | null> {
  try {
    const res = await authedFetch("/api/etudes/quota", user, { signal });
    return res ? await res.json() : null;
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.error("fetch etude status error:", error);
    }
    return null;
  }
}
