/**
 * The musical rules an etude is written and checked against: written ranges for
 * Bb trumpet, note values per difficulty, and the checks run on what Claude
 * returns. Mirrors the client's generator vocabulary (RANGE_NOTES, keys, time
 * signatures, note format), which lives in client/src/utils, client/src/lib and
 * client/src/schema; client/src/utils/etudeMirror.test.ts checks the two agree.
 * Keep this file free of imports, so that test can load it.
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

/** Bars an etude can be. Longer etudes cost more and take longer to write. */
export const ETUDE_MEASURES = { min: 4, max: 16, default: 8 } as const;

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

/**
 * What makes an etude as hard as its difficulty says, as things that can be counted.
 * The prompt states them and `difficultyProblems` checks them, so the two can't drift.
 * A leap is 5 semitones (a 4th) or more between neighbouring notes; a wide leap is 7
 * (a 5th) or more; the span is the distance from the lowest note to the highest.
 */
export type DifficultyTargets = {
  /** Share of notes that are eighths or shorter. */
  minShortShare: number;
  /** Sixteenths or dotted eighths, when the difficulty allows them. */
  minSixteenths: number;
  minLeaps: number;
  minWideLeaps: number;
  /** No leap wider than this, in semitones. */
  maxLeap: number;
  minSpan: number;
  /** Notes outside the key (raised 6ths and 7ths in minor count as in the key). */
  minChromatic: number;
};

export const DIFFICULTY_TARGETS: Record<Difficulty, DifficultyTargets> = {
  LOW: {
    minShortShare: 0,
    minSixteenths: 0,
    minLeaps: 0,
    minWideLeaps: 0,
    maxLeap: 7,
    minSpan: 7,
    minChromatic: 0,
  },
  MED: {
    minShortShare: 0.25,
    minSixteenths: 0,
    minLeaps: 3,
    minWideLeaps: 1,
    maxLeap: 12,
    minSpan: 12,
    minChromatic: 0,
  },
  HIGH: {
    minShortShare: 0.4,
    minSixteenths: 4,
    minLeaps: 6,
    minWideLeaps: 3,
    maxLeap: 15,
    minSpan: 17,
    minChromatic: 2,
  },
};

const INTERVAL_NAMES: Record<number, string> = {
  5: "a 4th",
  7: "a 5th",
  12: "an octave",
  15: "a 10th",
  17: "an 11th",
};

/** "an octave", or "12 semitones" for a distance with no name above. */
export const intervalName = (semitones: number) =>
  INTERVAL_NAMES[semitones] ?? `${semitones} semitones`;

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
// Natural minor, plus the raised 6th and 7th of melodic and harmonic minor.
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 9, 10, 11];

/** Pitch classes (0 = C) that belong to the key. */
function keyPitchClasses(musicKey: string): Set<number> {
  const [tonic, quality] = musicKey.split(" ");
  const root = midi(`${tonic}4`)! % 12;
  const steps = quality === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  return new Set(steps.map((s) => (root + s) % 12));
}

/** The counts `DIFFICULTY_TARGETS` are about, for one etude. */
export function measureEtude(bars: readonly (readonly NoteEvent[])[], musicKey: string) {
  const notes = bars.flat().filter((e) => e.pitch !== null);
  const pitches = notes.map((e) => midi(e.pitch!)!);
  const steps = pitches.slice(1).map((p, i) => Math.abs(p - pitches[i]));
  const inKey = keyPitchClasses(musicKey);
  return {
    notes: notes.length,
    shortShare: notes.length ? notes.filter((e) => e.quarters <= 0.5).length / notes.length : 0,
    sixteenths: notes.filter((e) => e.quarters === 0.25 || e.quarters === 0.75).length,
    leaps: steps.filter((s) => s >= 5).length,
    wideLeaps: steps.filter((s) => s >= 7).length,
    largestLeap: Math.max(0, ...steps),
    span: pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0,
    chromatic: pitches.filter((p) => !inKey.has(p % 12)).length,
  };
}

/**
 * Where an etude falls short of (or, for beginners, goes past) its difficulty, as
 * sentences Claude can act on. Unlike `findProblems`, these don't make an etude
 * unusable: an etude still short of them after its retry is kept.
 */
export function difficultyProblems(
  bars: readonly (readonly NoteEvent[])[],
  options: EtudeOptions,
): string[] {
  const target = DIFFICULTY_TARGETS[options.difficulty];
  const m = measureEtude(bars, options.musicKey);
  const sixteenthsAllowed = allowedDurations(options.difficulty, options.timeSig).includes(0.25);
  const problems: string[] = [];

  if (m.shortShare < target.minShortShare) {
    problems.push(
      `Only ${Math.round(m.shortShare * 100)}% of the notes are eighths or shorter; this difficulty needs at least ${target.minShortShare * 100}%.`,
    );
  }
  if (sixteenthsAllowed && m.sixteenths < target.minSixteenths) {
    problems.push(
      `It has ${m.sixteenths} sixteenths or dotted eighths; this difficulty needs at least ${target.minSixteenths}.`,
    );
  }
  if (m.leaps < target.minLeaps) {
    problems.push(
      `It has ${m.leaps} leaps of a 4th or more; this difficulty needs at least ${target.minLeaps}.`,
    );
  }
  if (m.wideLeaps < target.minWideLeaps) {
    problems.push(
      `It has ${m.wideLeaps} leaps of a 5th or more; this difficulty needs at least ${target.minWideLeaps}.`,
    );
  }
  if (m.largestLeap > target.maxLeap) {
    problems.push(
      `Its widest leap is ${intervalName(m.largestLeap)}; keep leaps to ${intervalName(target.maxLeap)} or less.`,
    );
  }
  if (m.span < target.minSpan) {
    problems.push(
      `It only spans ${intervalName(m.span)}; use at least ${intervalName(target.minSpan)} of the range.`,
    );
  }
  if (m.chromatic < target.minChromatic) {
    problems.push(
      `It has ${m.chromatic} notes outside the key; this difficulty needs at least ${target.minChromatic}.`,
    );
  }
  return problems;
}

/** Each note value an etude can use, in the app's note format. */
const NOTE_VALUES: Record<number, string> = {
  4: "w",
  3: "h.",
  2: "h",
  1.5: "q.",
  1: "q",
  0.75: "8.",
  0.5: "8",
  0.25: "16",
};

/**
 * An etude's bars in the app's note format, as history stores it and the client's
 * Staff reads it: "D4/q., Eb4/8, B4/h/r, Bb4/w". Matches what the client's notate()
 * writes for the same notes; every etude note fits in its bar and in one value, so
 * no ties are needed.
 */
export function etudeNotes(bars: readonly (readonly NoteEvent[])[]): string {
  return bars
    .flat()
    .map(({ pitch, quarters }) => {
      const value = NOTE_VALUES[quarters];
      if (!value) throw new Error(`No note value lasts ${quarters} quarter notes`);
      if (pitch !== null) return `${pitch}/${value}`;
      return value.endsWith(".") ? `B4/${value.slice(0, -1)}/r.` : `B4/${value}/r`;
    })
    .join(", ");
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
