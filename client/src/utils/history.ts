import type { MusicInfo } from "@/pages/Generate";
import type { User } from "firebase/auth";
import type { Dispatch, SetStateAction } from "react";

export async function getInitialHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
  setGenCount: Dispatch<SetStateAction<number>>,
) {
  const controller = new AbortController();
  async function loadHistory() {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/history`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const data: MusicInfo[] = await res.json();
      console.log("data:", data);

      setHistory(Object.fromEntries(data.map((item) => [item.generationNum, item])));
      setGenCount(data[0].generationNum);
      // setGenerated(data[0]);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.log("fetch history error: ", error);
    }
  }

  loadHistory();

  return () => controller.abort();
}

export async function insertToHistory(
  exercise: MusicInfo,
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
) {
  try {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        notes: exercise.notes,
        timeSig: exercise.timeSig,
        musicKey: exercise.musicKey,
        noteRange: exercise.range,
        difficulty: exercise.difficulty,
        generationNum: exercise.generationNum,
      }),
    });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    setHistory((prev) => ({ ...prev, [exercise.generationNum]: exercise }));
  } catch (error) {
    console.log("update history error: ", error);
  }
}

export async function clearHistory(
  user: User | undefined | null,
  setHistory: Dispatch<SetStateAction<Record<number, MusicInfo>>>,
) {
  try {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/history`, {
      method: "DELETE",
      headers: {
        // "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    setHistory({});
  } catch (error) {
    console.log("clear history error: ", error);
  }
}
