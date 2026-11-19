import { createContext } from "react";
import { DEFAULT_NOTE_RANGES } from "@/lib/noteRanges";
import type { Settings } from "@/schema";

export type SettingsStatus = "loading" | "ready" | "failed";

export type SettingsData = {
  /** The user's settings: the defaults until theirs have loaded, or if they couldn't be. */
  settings: Settings;
  status: SettingsStatus;
  /** Ask for them again, after a load that failed. */
  reload: () => void;
  /** Save new settings for everything to use. Rejects if the server didn't take them. */
  save: (next: Settings) => Promise<void>;
};

export const DEFAULT_SETTINGS: Settings = { noteRanges: DEFAULT_NOTE_RANGES };

export const SettingsContext = createContext<SettingsData>({
  settings: DEFAULT_SETTINGS,
  status: "loading",
  reload: () => {},
  save: async () => {},
});
