import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/useAuth";
import type { Settings } from "@/schema";
import { fetchSettings, saveSettings } from "@/utils/settings";
import {
  DEFAULT_SETTINGS,
  SettingsContext,
  type SettingsData,
  type SettingsStatus,
} from "./SettingsContext";

/**
 * Loads the signed-in user's settings once and shares them: Generate makes exercises in
 * the ranges they set, and Profile edits them. A save on Profile reaches Generate
 * without another request.
 */
export default function SettingsProvider({ children }: { readonly children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SettingsStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  // Settings belong to one account. On switching, drop the last one's before anything
  // uses them.
  const uid = user?.uid ?? null;
  const [owner, setOwner] = useState(uid);
  if (uid !== owner) {
    setOwner(uid);
    setSettings(DEFAULT_SETTINGS);
    setStatus("loading");
  }

  // The account signed in now, for a save that answers after a switch.
  const latestUid = useRef(uid);
  useEffect(() => {
    latestUid.current = uid;
  }, [uid]);

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();
    fetchSettings(user, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted || !loaded) return;
        setSettings(loaded);
        setStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("fetch settings error:", error);
        setStatus("failed");
      });
    return () => controller.abort();
  }, [user, authLoading, attempt]);

  const reload = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const save = useCallback(
    async (next: Settings) => {
      const saved = await saveSettings(user, next);
      if (saved && latestUid.current === uid) {
        setSettings(saved);
        setStatus("ready");
      }
    },
    [user, uid],
  );

  const value = useMemo<SettingsData>(
    () => ({ settings, status, reload, save }),
    [settings, status, reload, save],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
