import type { Difficulty } from "@/schema";

/** A rhythm figure: the lengths, in quarter notes, of notes that always come together. */
export type Figure = readonly number[];

/** What a difficulty's rhythms are built from, in one kind of meter. */
type Vocabulary = {
  figures: Figure[];
  /**
   * Whether a figure can start off the beat and run across the next one (a syncopation).
   * Otherwise a figure that starts off the beat has to end by the next beat, so eighths
   * and sixteenths fill out their beat.
   */
  syncopated: boolean;
};

const EIGHTH = 0.5;

/** Beats of a quarter note (x/4, and 2/2 counted in quarters). */
const LOW_SIMPLE: Figure[] = [
  [4], // whole
  [3], // dotted half
  [2], // half
  [1], // quarter
  [0.5], // eighth, which comes in pairs since it has to finish its beat
  [1.5, 0.5], // dotted quarter, eighth
];
const MED_SIMPLE: Figure[] = [
  ...LOW_SIMPLE,
  [0.25, 0.25], // two sixteenths, in place of an eighth
  [0.75, 0.25], // dotted eighth, sixteenth
  [0.5, 1, 0.5], // eighth, quarter, eighth
];
const HIGH_SIMPLE: Figure[] = [
  ...MED_SIMPLE,
  [0.25, 0.5, 0.25], // sixteenth, eighth, sixteenth
  [0.25, 0.75], // sixteenth, dotted eighth
  [0.25], // sixteenth
  [0.125, 0.125], // two thirty-seconds
];

/** Beats of a dotted quarter (6/8, 9/8, 12/8, 3/8). */
const LOW_COMPOUND: Figure[] = [
  [3], // dotted half
  [1.5], // dotted quarter
  [1, 0.5], // quarter, eighth
  [0.5], // eighth, which comes in threes since it has to finish its beat
];
const MED_COMPOUND: Figure[] = [
  ...LOW_COMPOUND,
  [0.25, 0.25], // two sixteenths, in place of an eighth
  [0.75, 0.25, 0.5], // dotted eighth, sixteenth, eighth
  [0.5, 1], // eighth, quarter
];
const HIGH_COMPOUND: Figure[] = [
  ...MED_COMPOUND,
  [0.25], // sixteenth
  [0.125, 0.125], // two thirty-seconds
];

const VOCABULARIES: Record<"simple" | "compound", Record<Difficulty, Vocabulary>> = {
  simple: {
    LOW: { figures: LOW_SIMPLE, syncopated: false },
    MED: { figures: MED_SIMPLE, syncopated: false },
    HIGH: { figures: HIGH_SIMPLE, syncopated: true },
  },
  compound: {
    LOW: { figures: LOW_COMPOUND, syncopated: false },
    MED: { figures: MED_COMPOUND, syncopated: false },
    HIGH: { figures: HIGH_COMPOUND, syncopated: true },
  },
};

/** The rhythms one difficulty can make in one time signature. */
export type Rhythm = Vocabulary & {
  /** The beat, in quarter notes: a dotted quarter in compound meters, else a quarter. */
  beat: number;
};

export function rhythmFor(timeSig: string, difficulty: Difficulty): Rhythm {
  const [beats, unit] = timeSig.split("/").map(Number);
  const compound = unit === 8 && beats % 3 === 0;
  return {
    ...VOCABULARIES[compound ? "compound" : "simple"][difficulty],
    beat: compound ? 1.5 : 1,
  };
}

export const figureLength = (figure: Figure) => figure.reduce((sum, length) => sum + length, 0);

/**
 * A random figure that can start `position` quarters into the music. A figure that
 * starts on the beat can be anything; off the beat it has to end by the next beat,
 * unless the rhythm is syncopated and it starts on an eighth. Keeps to at most `left`
 * quarters and `maxNotes` notes.
 */
export function randomFigure(
  rhythm: Rhythm,
  position: number,
  { left = Infinity, maxNotes = Infinity } = {},
): Figure {
  const offset = position % rhythm.beat;
  const placeable = (figure: Figure) => {
    const length = figureLength(figure);
    if (length > left || figure.length > maxNotes) return false;
    if (offset === 0 || offset + length <= rhythm.beat) return true;
    return rhythm.syncopated && offset % EIGHTH === 0;
  };
  const options = rhythm.figures.filter(placeable);
  if (options.length === 0) throw new Error(`No figure fits ${left} quarters at ${position}`);
  return options[Math.floor(Math.random() * options.length)];
}
