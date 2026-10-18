import type { User } from "firebase/auth";
import type { Difficulty, Key, Range } from "@/schema";
import { ApiError, authedFetch } from "./api";
import { notate, type NoteEvent } from "./notate";

/** Etudes left in the user's rolling 24 hours. Mirrors the server's QuotaStatus. */
export type EtudeQuota = {
  limit: number;
  remaining: number;
  /** When the oldest etude counted leaves the window, freeing one; null if none are counted. */
  resetsAt: string | null;
};

/** What an etude is asked for. Mirrors the body of the server's POST /api/etudes. */
export type EtudeRequest = {
  musicKey: Key;
  timeSig: string;
  measures: number;
  noteRange: Range;
  difficulty: Difficulty;
};

export type EtudeResult =
  | { ok: true; notes: string; quota: EtudeQuota }
  | { ok: false; message: string; quota?: EtudeQuota };

/** Etudes are written by Claude on the server, so they take a while to arrive. */
const OFFLINE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const FAILED_MESSAGE = "Couldn't write an etude this time. Try again.";

/** An etude's bars, one array of notes per bar, in the app's note format. */
export function etudeNotes(bars: readonly (readonly NoteEvent[])[], timeSig: string): string {
  return notate(bars.flat(), timeSig);
}

/**
 * Ask the server for an etude. Never throws: a failure comes back with the message
 * to show, which the server words for the player, and the quota when it sent one.
 */
export async function requestEtude(
  user: User | undefined | null,
  request: EtudeRequest,
): Promise<EtudeResult> {
  try {
    const res = await authedFetch("/api/etudes", user, {
      method: "POST",
      body: JSON.stringify(request),
    });
    if (!res) return { ok: false, message: "Sign in to generate etudes." };
    const { bars, quota }: { bars: NoteEvent[][]; quota: EtudeQuota } = await res.json();
    return { ok: true, notes: etudeNotes(bars, request.timeSig), quota };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = (error.body ?? {}) as { error?: unknown; quota?: EtudeQuota };
      const message = typeof body.error === "string" ? body.error : FAILED_MESSAGE;
      return { ok: false, message, quota: body.quota };
    }
    console.error("request etude error:", error);
    return { ok: false, message: OFFLINE_MESSAGE };
  }
}

/** How many etudes the user has left today, or null if it couldn't be loaded. */
export async function fetchEtudeQuota(
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<EtudeQuota | null> {
  try {
    const res = await authedFetch("/api/etudes/quota", user, { signal });
    return res ? await res.json() : null;
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.error("fetch etude quota error:", error);
    }
    return null;
  }
}
