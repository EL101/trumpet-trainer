import { defineKeyframes } from "@chakra-ui/react";

/**
 * Entrance animations. Most have only a `from` frame, so they animate to however the
 * element already looks. Run them with fill-mode `backwards` (hidden during the delay,
 * back to normal styles afterwards) and gate them behind `_motionSafe`.
 */
export const keyframes = defineKeyframes({
  /** Fade in from transparent to the element's own opacity. */
  appear: { from: { opacity: 0 } },
  /** Fade in while rising a little into place, for text. */
  "rise-in": { from: { opacity: 0, transform: "translateY(12px)" } },
  /**
   * Grow in from slightly small and transparent; pair with an overshooting easing to pop.
   * Hidden until it starts, so it can't be focused or clicked during its delay.
   */
  "pop-in": { from: { opacity: 0, transform: "scale(0.85)", visibility: "hidden" } },
  /** Slide in along x from `--slide-from` (e.g. `-450px`). */
  "slide-in": { from: { transform: "translateX(var(--slide-from))" } },
  /** Draw a stroke from its start. Give the path `pathLength={1}` and `strokeDasharray: 1`. */
  "draw-on": { from: { strokeDashoffset: 1 } },
  /** Reveal left to right, leaving room above and below for content that overflows. */
  "wipe-in": {
    from: { clipPath: "inset(-50% 100% -50% 0)" },
    to: { clipPath: "inset(-50% 0 -50% 0)" },
  },
});
