import type { Dispatch, SetStateAction } from "react";
import type { User } from "firebase/auth";
import { toExerciseInput, type MusicInfo } from "@/schema";
import { authedFetch } from "./api";

export function getInitialHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
  setGenCount: Dispatch<SetStateAction<number>>,
) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await authedFetch("/api/history", user, { signal: controller.signal });
      if (!res) return;

      const data: MusicInfo[] = await res.json();
      setHistory(Object.fromEntries(data.map((item) => [item.generationNum, item])));
      // The list comes back newest-first, so the first row holds the highest gen number.
      setGenCount(data[0]?.generationNum ?? 0);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("fetch history error:", error);
    }
  })();

  return () => controller.abort();
}

export async function insertToHistory(
  exercise: MusicInfo,
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
) {
  try {
    const res = await authedFetch("/api/history", user, {
      method: "POST",
      body: JSON.stringify(toExerciseInput(exercise)),
    });
    if (!res) return;
    setHistory((prev) => ({ ...prev, [exercise.generationNum]: exercise }));
  } catch (error) {
    console.error("update history error:", error);
  }
}

export async function clearHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
) {
  try {
    const res = await authedFetch("/api/history", user, { method: "DELETE" });
    if (!res) return;
    setHistory({});
  } catch (error) {
    console.error("clear history error:", error);
  }
}
