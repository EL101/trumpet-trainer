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

/** Swaps ASCII accidentals for music symbols: "Bb major" → "B♭ major", "F#3" → "F♯3". */
export function formatPitch(text: string): string {
  return text.replace(/([A-G])#/g, "$1♯").replace(/([A-G])b/g, "$1♭");
}

export type ExerciseMetaParts = {
  /** "G major", or a source like "Generated". */
  keyLabel?: string;
  /** "4/4". */
  timeSig?: string;
  bars?: number;
  minutes?: number;
};

/**
 * Exercise details as the mockups write them: ["G major", "4/4", "8 bars", "6 min"]. The
 * tempo ("♩ = 96") is drawn, so ExerciseMeta puts it in after the time signature.
 */
export function formatExerciseMeta({
  keyLabel,
  timeSig,
  bars,
  minutes,
}: ExerciseMetaParts): string[] {
  return [
    keyLabel,
    timeSig,
    bars != null ? `${bars} ${bars === 1 ? "bar" : "bars"}` : undefined,
    minutes != null ? `${minutes} min` : undefined,
  ].filter((s): s is string => !!s);
}

/** A date in full, as the profile writes when an account was made: "2 June 2026". */
export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
