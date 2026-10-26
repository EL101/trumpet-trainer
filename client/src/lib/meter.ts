/** Clicks per beat a metronome can give, and how its control writes them. */
export type Subdivision = {
  per: number;
  /** Note values, as on the mockup's control: "♪♪" for eighths against a quarter beat. */
  symbol: string;
  /** For screen readers. */
  label: string;
};

/** How a time signature is counted. */
export type Pulse = {
  /** Beats in a bar. */
  beats: number;
  /** One beat's length in quarter notes. */
  quarters: number;
  /** The beat's note value as a tempo mark writes it: "♩" in 4/4, "♩." in 6/8. */
  symbol: string;
  /** The clicks per beat on offer, the plain beat first. */
  subdivisions: readonly Subdivision[];
};

/** The half note's character, which TempoMark draws because fonts rarely have it. */
export const HALF_NOTE = "\u{1D15E}";

/** Tempo limits, in beats per minute, as on a mechanical metronome. */
export const MIN_TEMPO = 40;
export const MAX_TEMPO = 208;

const QUARTER: Pulse = {
  beats: 4,
  quarters: 1,
  symbol: "♩",
  subdivisions: [
    { per: 1, symbol: "♩", label: "Quarter notes" },
    { per: 2, symbol: "♪♪", label: "Eighth notes" },
    { per: 4, symbol: "♬", label: "Sixteenth notes" },
  ],
};

const HALF: Pulse = {
  beats: 2,
  quarters: 2,
  symbol: HALF_NOTE,
  subdivisions: [
    { per: 1, symbol: HALF_NOTE, label: "Half notes" },
    { per: 2, symbol: "♩♩", label: "Quarter notes" },
    { per: 4, symbol: "♪♪", label: "Eighth notes" },
  ],
};

const DOTTED_QUARTER: Pulse = {
  beats: 2,
  quarters: 1.5,
  symbol: "♩.",
  subdivisions: [
    { per: 1, symbol: "♩.", label: "Dotted quarter notes" },
    { per: 3, symbol: "♪♪♪", label: "Eighth notes" },
  ],
};

const EIGHTH: Pulse = {
  beats: 3,
  quarters: 0.5,
  symbol: "♪",
  subdivisions: [
    { per: 1, symbol: "♪", label: "Eighth notes" },
    { per: 2, symbol: "♬", label: "Sixteenth notes" },
  ],
};

/**
 * The beat a time signature is counted in: quarters in 4/4, halves in 2/2, dotted
 * quarters in 6/8, 9/8 and 12/8, and eighths in 3/8.
 */
export function pulseOf(timeSig: string): Pulse {
  const [top, bottom] = timeSig.split("/").map(Number);
  if (bottom === 2) return { ...HALF, beats: top };
  if (bottom === 8 && top % 3 === 0 && top > 3) return { ...DOTTED_QUARTER, beats: top / 3 };
  if (bottom === 8) return { ...EIGHTH, beats: top };
  return { ...QUARTER, beats: top, quarters: 4 / bottom };
}

/** A bar's length in quarter notes. */
export function barQuarters(pulse: Pulse) {
  return pulse.beats * pulse.quarters;
}

/** Which beat of its bar a position (in quarter notes from the top) falls on, from 0. */
export function beatAt(pulse: Pulse, position: number) {
  const bar = barQuarters(pulse);
  // Count-ins run before the top, so wrap negative positions into their bar too.
  const intoBar = ((position % bar) + bar) % bar;
  return Math.min(pulse.beats - 1, Math.floor(intoBar / pulse.quarters + 1e-9));
}
