import type { Dispatch, SetStateAction } from "react";
import type { User } from "firebase/auth";
import { toExerciseInput, type MusicInfo } from "@/schema";
import { authedFetch } from "./api";

export function getInitialLibrary(
  user: User | undefined | null,
  setSaved: Dispatch<SetStateAction<MusicInfo[]>>,
) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await authedFetch("/api/library", user, { signal: controller.signal });
      if (!res) return;
      setSaved(await res.json());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("fetch library error:", error);
    }
  })();

  return () => controller.abort();
}

export async function saveToLibrary(exercise: MusicInfo, user: User | undefined | null) {
  const res = await authedFetch("/api/library", user, {
    method: "POST",
    body: JSON.stringify(toExerciseInput(exercise)),
  });
  return res !== null;
}
