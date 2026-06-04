import type { MusicInfo } from "@/pages/Generate";
import type { User } from "firebase/auth";
import type { Dispatch, SetStateAction } from "react";

export async function getInitialLibrary(user: User | undefined | null, setSaved: Dispatch<SetStateAction<MusicInfo[]>>) {
  const controller = new AbortController();
  async function loadSaved() {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/library`, {
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

      setSaved(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.log("fetch library error: ", error);
    }
  }
  loadSaved();
  return () => controller.abort();
}
