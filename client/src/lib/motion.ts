/**
 * Whether the viewer asks for reduced motion, for code that animates outside CSS
 * (scrolling, the Web Animations API, timers, hand-drawn SVG), where `_motionSafe`
 * can't reach. False where `matchMedia` doesn't exist.
 */
export function prefersReducedMotion() {
  return !!globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A figure counting up to `target`, `elapsed` ms into a count lasting `duration`: whole
 * numbers, fast at first and settling onto the target (ease-out cubic).
 */
export function countUpAt(target: number, elapsed: number, duration: number) {
  const t = duration > 0 ? Math.min(Math.max(elapsed / duration, 0), 1) : 1;
  return Math.round(target * (1 - (1 - t) ** 3));
}
