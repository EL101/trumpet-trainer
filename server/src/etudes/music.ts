/**
 * The musical rules an etude is written and checked against: written ranges for
 * Bb trumpet, note values per difficulty, and the checks run on what Claude
 * returns. Mirrors the client's generator vocabulary (RANGE_NOTES, keys, time
 * signatures), which lives in client/src/utils and client/src/lib.
 */

export const PITCH_CLASSES = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
] as const;

export const KEY_PATTERN = new RegExp(`^(${PITCH_CLASSES.join("|")}) (major|minor)$`);

export const RANGES = ["LOW", "MED", "HIGH", "ANY"] as const;
export type Range = (typeof RANGES)[number];

export const DIFFICULTIES = ["LOW", "MED", "HIGH"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TIME_SIGNATURES = ["4/4", "3/4", "2/4", "2/2", "6/8", "3/8", "9/8", "12/8"] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

/** Lowest and highest written note for each range. Mirrors the client's RANGE_NOTES. */
export const RANGE_NOTES: Record<Range, readonly [string, string]> = {
  LOW: ["F#3", "C5"],
  MED: ["C4", "C6"],
  HIGH: ["C5", "G6"],
  ANY: ["F#3", "G6"],
};

/** A note, or a rest when `pitch` is null, and how long it lasts in quarter notes. */
export type NoteEvent = { pitch: string | null; quarters: number };

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a pitch like "Bb4" or "F#5", or null if it isn't one. */
export function midi(pitch: string): number | null {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitch);
  if (!m) return null;
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + SEMITONES[m[1]] + accidental;
}

/**
 * Every spelling of every pitch inside the range, lowest first. Both spellings
 * of each black key are offered, since keys and minor-mode leading notes need
 * either; the prompt asks for spelling that suits the key.
 */
export function pitchesInRange(range: Range): string[] {
  const [low, high] = RANGE_NOTES[range].map((note) => midi(note)!);
  return [2, 3, 4, 5, 6, 7]
    .flatMap((octave) => PITCH_CLASSES.map((pc) => `${pc}${octave}`))
    .filter((pitch) => {
      const m = midi(pitch)!;
      return m >= low && m <= high;
    })
    .sort((a, b) => midi(a)! - midi(b)!);
}

/** A bar's length in quarter notes: 4 in 4/4 and 2/2, 3 in 3/4 and 6/8. */
export function barLength(timeSig: string): number {
  const [beats, unit] = timeSig.split("/").map(Number);
  return (beats * 4) / unit;
}

// Note values in quarter notes: 4 whole, 3 dotted half, 2 half, 1.5 dotted
// quarter, 1 quarter, 0.75 dotted eighth, 0.5 eighth, 0.25 sixteenth.
const SIMPLE_DURATIONS: Record<Difficulty, number[]> = {
  LOW: [4, 3, 2, 1],
  MED: [4, 3, 2, 1.5, 1, 0.5],
  HIGH: [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25],
};

// Compound meters (6/8, 9/8, …) beat in dotted quarters, so even the easiest
// etude needs dotted quarters and eighths.
const COMPOUND_DURATIONS: Record<Difficulty, number[]> = {
  LOW: [3, 1.5, 1, 0.5],
  MED: [3, 2, 1.5, 1, 0.5],
  HIGH: [3, 2, 1.5, 1, 0.75, 0.5, 0.25],
};

/** Note values an etude of this difficulty may use, longest first, none longer than a bar. */
export function allowedDurations(difficulty: Difficulty, timeSig: string): number[] {
  const compound = timeSig.endsWith("/8");
  const durations = (compound ? COMPOUND_DURATIONS : SIMPLE_DURATIONS)[difficulty];
  return durations.filter((q) => q <= barLength(timeSig));
}

/** What an etude is asked for. Matches the request body of POST /api/etudes. */
export type EtudeOptions = {
  musicKey: string;
  timeSig: TimeSignature;
  measures: number;
  noteRange: Range;
  difficulty: Difficulty;
  character?: string;
};

/**
 * What's wrong with an etude, as sentences Claude can act on when asked to fix
 * it. Empty when it's fine. The output schema already limits pitches and note
 * values, but they're checked again here so a schema change can't let a bad
 * note through.
 */
export function findProblems(bars: readonly (readonly NoteEvent[])[], options: EtudeOptions) {
  const problems: string[] = [];
  const length = barLength(options.timeSig);
  const pitches = new Set(pitchesInRange(options.noteRange));
  const durations = new Set(allowedDurations(options.difficulty, options.timeSig));
  const [low, high] = RANGE_NOTES[options.noteRange];

  if (bars.length !== options.measures) {
    problems.push(`It has ${bars.length} bars, but ${options.measures} were asked for.`);
  }

  bars.forEach((bar, i) => {
    const n = i + 1;
    const total = bar.reduce((sum, e) => sum + e.quarters, 0);
    if (total !== length) {
      problems.push(
        `Bar ${n} adds up to ${total} quarter notes, but a bar of ${options.timeSig} is ${length}.`,
      );
    }
    for (const e of bar) {
      if (e.pitch !== null && !pitches.has(e.pitch)) {
        problems.push(`Bar ${n} has ${e.pitch}, outside the range ${low} to ${high}.`);
      }
      if (!durations.has(e.quarters)) {
        problems.push(`Bar ${n} uses a note of ${e.quarters} quarter notes, which isn't allowed.`);
      }
    }
  });

  const tonic = options.musicKey.split(" ")[0];
  const last = bars
    .flat()
    .filter((e) => e.pitch !== null)
    .at(-1);
  if (last && midi(last.pitch!)! % 12 !== midi(`${tonic}4`)! % 12) {
    problems.push(`It ends on ${last.pitch}, but it should end on the tonic, ${tonic}.`);
  }
  if (!last) problems.push("It has no notes, only rests.");

  return problems;
}
