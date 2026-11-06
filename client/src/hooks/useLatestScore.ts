import { useContext, useEffect, useState } from "react";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { getLatestScore, type SavedScore } from "@/utils/scores";

/**
 * The newest scored run of an exercise, loaded for the signed-in user: undefined while
 * it loads, null if there's none (or no exercise). `setScore` puts in one just saved.
 */
export function useLatestScore(exerciseId: string | null | undefined) {
  const { user } = useContext(AuthUserContext);
  const [loaded, setLoaded] = useState<{ id: string; score: SavedScore | null } | null>(null);

  useEffect(() => {
    if (!exerciseId || !user) return;
    const controller = new AbortController();
    getLatestScore(exerciseId, user, controller.signal)
      .then((score) => {
        if (!controller.signal.aborted) setLoaded({ id: exerciseId, score });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // Not worth a notice: the button just doesn't show until it loads.
        console.error("load score error:", error);
      });
    return () => controller.abort();
  }, [exerciseId, user]);

  const score = !exerciseId || !user ? null : loaded?.id === exerciseId ? loaded.score : undefined;
  const setScore = (saved: SavedScore) => setLoaded({ id: saved.exerciseId, score: saved });
  return { score, setScore };
}
