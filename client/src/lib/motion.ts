/**
 * Whether the viewer asks for reduced motion, for code that animates outside CSS
 * (scrolling, the Web Animations API, timers, hand-drawn SVG), where `_motionSafe`
 * can't reach. False where `matchMedia` doesn't exist.
 */
export function prefersReducedMotion() {
  return !!globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
