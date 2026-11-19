import { useEffect, useState } from "react";
import { countUpAt, prefersReducedMotion } from "@/lib/motion";

/**
 * A figure that counts up from 0 the first time it arrives (`target` goes from
 * undefined to a number), then follows `target` as it changes, without counting.
 * Lands at once for viewers who prefer reduced motion.
 */
export function useCountUp(target: number | undefined, duration = 800) {
  const [counting, setCounting] = useState<number | null>(null);
  const [counted, setCounted] = useState(false);
  const still = target === undefined || target === 0 || counted || prefersReducedMotion();

  useEffect(() => {
    if (still) return;
    let frame = requestAnimationFrame(function step(now, start = now) {
      const elapsed = now - start;
      if (elapsed >= duration) {
        setCounted(true);
        setCounting(null);
        return;
      }
      setCounting(countUpAt(target, elapsed, duration));
      frame = requestAnimationFrame((next) => step(next, start));
    });
    return () => cancelAnimationFrame(frame);
  }, [still, target, duration]);

  // From the render it arrives in, so the number never shows before counting.
  return still ? target : (counting ?? 0);
}
