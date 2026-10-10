const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 1 → "I", 4 → "IV" (enough for section numbering). */
export function toRoman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

export type ExerciseMetaParts = {
  /** "G major", or a source like "Generated". */
  keyLabel?: string;
  tempo?: number;
  bars?: number;
  minutes?: number;
};

/** Exercise details as the mockups write them: ["G major", "♩ = 96", "8 bars", "6 min"]. */
export function formatExerciseMeta({
  keyLabel,
  tempo,
  bars,
  minutes,
}: ExerciseMetaParts): string[] {
  return [
    keyLabel,
    tempo != null ? `♩ = ${tempo}` : undefined,
    bars != null ? `${bars} ${bars === 1 ? "bar" : "bars"}` : undefined,
    minutes != null ? `${minutes} min` : undefined,
  ].filter((s): s is string => !!s);
}
