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

/**
 * Delete the user's history, keeping `keep` (the exercise on the plate) as the new No. 1
 * in the same request, so there's no moment it's in neither history nor the library (the
 * server's prune would take its feedback for orphaned).
 *
 * Resolves to whether it was cleared, and the kept exercise with its new number. `kept`
 * is null with nothing to keep, or from a server built before `keep`, which clears
 * everything: then it's for the caller to save it again.
 */
export async function clearHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
  keep?: MusicInfo,
): Promise<{ cleared: boolean; kept: MusicInfo | null }> {
  try {
    const res = await authedFetch("/api/history", user, {
      method: "DELETE",
      ...(keep ? { body: JSON.stringify({ keep: toHistoryInput(keep) }) } : {}),
    });
    if (!res) return { cleared: false, kept: null };
    if (!keep || res.status === 204) {
      setHistory({});
      return { cleared: true, kept: null };
    }
    const row: MusicInfo = await res.json();
    const kept = { ...keep, generationNum: row.generationNum };
    setHistory({ [kept.generationNum]: kept });
    return { cleared: true, kept };
  } catch (error) {
    console.error("clear history error:", error);
    return { cleared: false, kept: null };
  }
}
