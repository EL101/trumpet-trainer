import { defineKeyframes } from "@chakra-ui/react";

/**
 * Entrance animations, exits, and loops for waiting. Most entrances have only a
 * `from` frame, so they animate to however the element already looks. Run them with
 * fill-mode `backwards` (hidden during the delay, back to normal styles afterwards) and
 * gate them behind `_motionSafe`.
 */
export const keyframes = defineKeyframes({
  /** Fade in from transparent to the element's own opacity. */
  appear: { from: { opacity: 0 } },
  /** Fade in while rising a little into place, for text. */
  "rise-in": { from: { opacity: 0, transform: "translateY(12px)" } },
  /** Fade out while sinking a little: `rise-in` in reverse. Run with fill-mode `forwards`. */
  "sink-out": { to: { opacity: 0, transform: "translateY(12px)" } },
  /**
   * Grow in from slightly small and transparent; pair with an overshooting easing to pop.
   * Hidden until it starts, so it can't be focused or clicked during its delay.
   */
  "pop-in": { from: { opacity: 0, transform: "scale(0.85)", visibility: "hidden" } },
  /** Slide in along x from `--slide-from` (e.g. `-450px`). */
  "slide-in": { from: { transform: "translateX(var(--slide-from))" } },
  /**
   * Open downwards from nothing, pushing what's below it down. Put it on a grid wrapping
   * one child that has `minHeight: 0` and `overflow: hidden`. Its margins open from
   * nothing too, so space it from its neighbours with margins: a gap would appear at once.
   */
  unfold: { from: { gridTemplateRows: "0fr", marginBlock: 0, opacity: 0 } },
  /** Close upwards to nothing: `unfold` in reverse. Run with fill-mode `forwards`. */
  fold: { to: { gridTemplateRows: "0fr", marginBlock: 0, opacity: 0 } },
  /** Draw a stroke from its start. Give the path `pathLength={1}` and `strokeDasharray: 1`. */
  "draw-on": { from: { strokeDashoffset: 1 } },
  /** Reveal left to right, leaving room above and below for content that overflows. */
  "wipe-in": {
    from: { clipPath: "inset(-50% 100% -50% 0)" },
    to: { clipPath: "inset(-50% 0 -50% 0)" },
  },
  /** Waiting: dim and brighten, for placeholders standing in for content. Loop it. */
  pulse: { "50%": { opacity: 0.45 } },
  /**
   * Waiting: a note is written in, held, then fades for the next round. Loop it
   * (`infinite`), staggering each note's delay so they appear one after another.
   */
  "write-note": {
    "0%": { opacity: 0, transform: "translateY(3px)" },
    "15%": { opacity: 1, transform: "translateY(0)" },
    "70%": { opacity: 1 },
    "90%, 100%": { opacity: 0 },
  },
});
