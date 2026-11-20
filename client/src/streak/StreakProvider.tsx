import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/useAuth";
import type { Streak } from "@/schema";
import { fetchStreak } from "@/utils/profile";
import { StreakContext, type StreakData } from "./StreakContext";

/**
 * Loads the signed-in user's streak and shares it: the sidebar shows it on every page,
 * and Profile shows the longest. It's asked for again after anything here that changes
 * it (the player saving a run, Profile resetting practice data, through `refresh`), and
 * whenever the tab comes back into view, which catches a day that's gone by or play in
 * another tab. The last one stays on screen meanwhile.
 */
export default function StreakProvider({ children }: { readonly children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [streak, setStreak] = useState<Streak | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A streak belongs to one account. On switching, drop the last one's.
  const uid = user?.uid ?? null;
  const [owner, setOwner] = useState(uid);
  if (uid !== owner) {
    setOwner(uid);
    setStreak(null);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    const controller = new AbortController();
    fetchStreak(user, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted && loaded) setStreak(loaded);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.error("fetch streak error:", error);
      });
    return () => controller.abort();
  }, [user, authLoading, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [refresh]);

  const value = useMemo<StreakData>(() => ({ streak, refresh }), [streak, refresh]);
  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}
