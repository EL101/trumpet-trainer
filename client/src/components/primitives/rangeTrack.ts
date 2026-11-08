/**
 * Where `value` sits along a `RangeSlider`'s rail, as a CSS length from its left edge. A
 * native thumb's centre runs from half a thumb in to half a thumb from the end, so the
 * band and the axis's marks use the same insets to line up with it.
 */
export function trackPosition(value: number, min: number, max: number) {
  const fraction = max > min ? (value - min) / (max - min) : 0;
  return `calc(var(--range-thumb) / 2 + (100% - var(--range-thumb)) * ${fraction})`;
}

/** How far apart two values are along the rail, as a CSS length. */
export function trackLength(from: number, to: number, min: number, max: number) {
  const fraction = max > min ? (to - from) / (max - min) : 0;
  return `calc((100% - var(--range-thumb)) * ${fraction})`;
}
