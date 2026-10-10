import { roles } from "@/theme";

/** Cents at which each intonation colour is reached; beyond the last stop the colour holds. */
export const CENTS_STOPS = [
  { cents: 0, color: roles.intonation.good },
  { cents: 15, color: roles.intonation.warn },
  { cents: 35, color: roles.intonation.bad },
] as const;

export const MAX_CENTS = CENTS_STOPS[CENTS_STOPS.length - 1].cents;

/** CSS gradient matching `centsColor` across 0…MAX_CENTS, for legends. */
export const CENTS_GRADIENT = `linear-gradient(90deg, ${CENTS_STOPS.map(
  (s) => `${s.color} ${(s.cents / MAX_CENTS) * 100}%`,
).join(", ")})`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Colour for a note played `cents` away from its target, interpolated continuously from
 * in tune (green) through ~15¢ (ochre) to 35¢+ (red). Returns an `rgb()` string so it can
 * be used both in CSS and inside VexFlow-rendered SVG.
 */
export function centsColor(cents: number): string {
  const a = Math.min(Math.abs(cents), MAX_CENTS);
  for (let i = 0; i < CENTS_STOPS.length - 1; i++) {
    const lo = CENTS_STOPS[i];
    const hi = CENTS_STOPS[i + 1];
    if (a <= hi.cents) {
      const t = (a - lo.cents) / (hi.cents - lo.cents);
      const [r0, g0, b0] = hexToRgb(lo.color);
      const [r1, g1, b1] = hexToRgb(hi.color);
      const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
      return `rgb(${mix(r0, r1)}, ${mix(g0, g1)}, ${mix(b0, b1)})`;
    }
  }
  return roles.intonation.bad;
}

/** "+9¢", "−4¢" (true minus sign), "0¢". */
export function formatCents(cents: number, unit = true): string {
  const r = Math.round(cents);
  const s = r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : "0";
  return unit ? `${s}¢` : s;
}

export type ScoreBand = keyof typeof roles.intonation;

/**
 * Banding for 0–100 exercise scores. The mockups show 93 in green and 81 in olive; the
 * lower cut-offs are an assumption until real scoring exists.
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return "good";
  if (score >= 75) return "fair";
  if (score >= 60) return "warn";
  return "bad";
}

/** Semantic token name for a score, e.g. `intonation.good`. */
export function scoreColorToken(score: number): `intonation.${ScoreBand}` {
  return `intonation.${scoreBand(score)}`;
}
