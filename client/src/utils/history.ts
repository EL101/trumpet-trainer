import type { Dispatch, SetStateAction } from "react";
import type { User } from "firebase/auth";
import { toHistoryInput, type MusicInfo } from "@/schema";
import { ApiError, authedFetch } from "./api";

/**
 * The user's history as Generate lists it: the newest HISTORY_LIMIT exercises, newest
 * first. Older rows wait in the database for the hourly prune, but they're no longer
 * listed, so they aren't in here. Resolves to an empty list without a signed-in user;
 * throws if it couldn't be asked.
 */
export async function listHistory(
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<MusicInfo[]> {
  const res = await authedFetch("/api/history", user, { signal });
  return res ? await res.json() : [];
}

/** Loads the user's history into `setHistory`, then calls `onLoaded` with it. */
export function getInitialHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
  onLoaded?: (entries: MusicInfo[]) => void,
) {
  if (!user) return () => {};
  const controller = new AbortController();

  listHistory(user, controller.signal)
    .then((data) => {
      if (controller.signal.aborted) return;
      setHistory(Object.fromEntries(data.map((item) => [item.generationNum, item])));
      onLoaded?.(data);
    })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("fetch history error:", error);
    });

  return () => controller.abort();
}

/**
 * One exercise from the user's history, by its exercise id. Resolves to null if
 * history has no such exercise; throws if it couldn't be asked.
 */
export async function getHistoryEntry(
  exerciseId: string,
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<MusicInfo | null> {
  try {
    const res = await authedFetch(`/api/history/${encodeURIComponent(exerciseId)}`, user, {
      signal,
    });
    return res ? await res.json() : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Save an exercise to history. Resolves to the exercise with the number the
 * server gave it, or null if it couldn't be saved.
 */
export async function insertToHistory(
  exercise: MusicInfo,
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
) {
  try {
    const res = await authedFetch("/api/history", user, {
      method: "POST",
      body: JSON.stringify(toHistoryInput(exercise)),
    });
    if (!res) return null;
    const row: MusicInfo = await res.json();
    const saved = { ...exercise, generationNum: row.generationNum };
    setHistory((prev) => ({ ...prev, [saved.generationNum]: saved }));
    return saved;
  } catch (error) {
    console.error("update history error:", error);
    return null;
  }
}

/** Delete the user's history. Resolves to whether it was cleared. */
export async function clearHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
) {
  try {
    const res = await authedFetch("/api/history", user, { method: "DELETE" });
    if (!res) return false;
    setHistory({});
    return true;
  } catch (error) {
    console.error("clear history error:", error);
    return false;
  }
}
