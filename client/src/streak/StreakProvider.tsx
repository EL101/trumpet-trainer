import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import type { Streak } from "@/schema";
import { fetchStreak } from "@/utils/profile";
import { StreakContext, type StreakData } from "./StreakContext";

/**
 * Loads the signed-in user's streak and shares it: the sidebar shows it on every page,
 * and Profile shows the longest. It's asked for again on each move to another page, so
 * coming back from practice shows the day just played, and the last one stays on
 * screen meanwhile.
 */
export default function StreakProvider({ children }: { readonly children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
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
  }, [user, authLoading, pathname, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo<StreakData>(() => ({ streak, refresh }), [streak, refresh]);
  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}
