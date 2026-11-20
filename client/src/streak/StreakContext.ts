import { createContext } from "react";
import type { Streak } from "@/schema";

export type StreakData = {
  /** The signed-in user's streak: null until it's loaded, or if it couldn't be. */
  streak: Streak | null;
  /** Ask for it again, after something that changes it (a run saved, a reset). */
  refresh: () => void;
};

export const StreakContext = createContext<StreakData>({ streak: null, refresh: () => {} });
