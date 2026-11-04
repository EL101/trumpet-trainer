import type { Dispatch, SetStateAction } from "react";
import type { User } from "firebase/auth";
import { toExerciseInput, type LibraryEntry, type MusicInfo } from "@/schema";
import { ApiError, authedFetch } from "./api";

/**
 * Every exercise in the user's library, newest saved first. Resolves to an empty list
 * without a signed-in user; throws if it couldn't be asked.
 */
export async function listLibrary(
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<LibraryEntry[]> {
  const res = await authedFetch("/api/library", user, { signal });
  return res ? await res.json() : [];
}

/** Loads the library into `setSaved`, logging a failure. Returns a cleanup that cancels it. */
export function getInitialLibrary(
  user: User | undefined | null,
  setSaved: Dispatch<SetStateAction<MusicInfo[]>>,
) {
  const controller = new AbortController();

  listLibrary(user, controller.signal)
    .then((entries) => {
      if (!controller.signal.aborted) setSaved(entries);
    })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("fetch library error:", error);
    });

  return () => controller.abort();
}

/**
 * One exercise from the user's library, by its exercise id. Resolves to null if the
 * library has no such exercise; throws if it couldn't be asked.
 */
export async function getLibraryEntry(
  exerciseId: string,
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<MusicInfo | null> {
  try {
    const res = await authedFetch(`/api/library/${encodeURIComponent(exerciseId)}`, user, {
      signal,
    });
    return res ? await res.json() : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveToLibrary(exercise: MusicInfo, user: User | undefined | null) {
  const res = await authedFetch("/api/library", user, {
    method: "POST",
    body: JSON.stringify(toExerciseInput(exercise)),
  });
  return res !== null;
}

/**
 * Removes an exercise from the user's library. One already gone (removed in another
 * tab, say) counts as removed. Throws if it couldn't be asked.
 */
export async function removeFromLibrary(exerciseId: string, user: User | undefined | null) {
  try {
    await authedFetch(`/api/library/${encodeURIComponent(exerciseId)}`, user, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}
