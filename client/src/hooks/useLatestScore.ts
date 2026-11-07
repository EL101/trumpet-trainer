import { useContext, useEffect, useRef, useState } from "react";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { getLatestScore, type SavedScore } from "@/utils/scores";

/**
 * The newest scored run of an exercise, loaded for the signed-in user: undefined while
 * it loads, null if there's none (or no exercise). `setScore` puts in one just saved.
 * What's loaded is kept with the user it was loaded for, so after a switch of account
 * (in another tab) the last one's feedback isn't shown while the new one's loads. A run
 * saved while the load is still out stops it, so the older score it would bring back
 * can't replace the new one.
 */
export function useLatestScore(exerciseId: string | null | undefined) {
  const { user } = useContext(AuthUserContext);
  const [loaded, setLoaded] = useState<{
    uid: string;
    id: string;
    score: SavedScore | null;
  } | null>(null);
  // The load still out, if one is: `setScore` stops it.
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!exerciseId || !user) return;
    const controller = new AbortController();
    pending.current = controller;
    getLatestScore(exerciseId, user, controller.signal)
      .then((score) => {
        if (!controller.signal.aborted) setLoaded({ uid: user.uid, id: exerciseId, score });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // Not worth a notice: the button just doesn't show until it loads.
        console.error("load score error:", error);
      });
    return () => controller.abort();
  }, [exerciseId, user]);

  const score =
    !exerciseId || !user
      ? null
      : loaded?.uid === user.uid && loaded.id === exerciseId
        ? loaded.score
        : undefined;
  const setScore = (saved: SavedScore) => {
    if (!user) return;
    pending.current?.abort();
    setLoaded({ uid: user.uid, id: saved.exerciseId, score: saved });
  };
  return { score, setScore };
}
