import { DIFFICULTIES, type Difficulty, type ExerciseType, type Key, type Range } from "@/schema";

/**
 * Every key the generator plays in, as [major, relative minor] rows. The first
 * `COMMON_KEY_ROWS` are the everyday ones; the rest follow by number of accidentals.
 */
export const KEY_ROWS: readonly (readonly [Key, Key])[] = [
  ["C major", "A minor"],
  ["G major", "E minor"],
  ["F major", "D minor"],
  ["Bb major", "G minor"],
  ["D major", "B minor"],
  ["Eb major", "C minor"],
  ["A major", "F# minor"],
  ["Ab major", "F minor"],
  ["E major", "C# minor"],
  ["Db major", "Bb minor"],
  ["B major", "G# minor"],
  ["Gb major", "Eb minor"],
  ["F# major", "D# minor"],
  ["C# major", "A# minor"],
];

export const COMMON_KEY_ROWS = 5;

/** Keys in reading order (major, minor, major, …): the common ones, or all of them. */
export function keyChoices(all: boolean): Key[] {
  return KEY_ROWS.slice(0, all ? undefined : COMMON_KEY_ROWS).flat();
}

export function isCommonKey(key: Key): boolean {
  return keyChoices(false).includes(key);
}

export const TIME_SIGNATURES = ["4/4", "3/4", "2/4", "2/2", "6/8", "3/8", "9/8", "12/8"] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export const MEASURE_LIMITS = { min: 1, max: 8 } as const;

/** Bars an etude can be. Mirrors the server's ETUDE_MEASURES: phrases need room. */
export const ETUDE_MEASURE_LIMITS = { min: 4, max: 16 } as const;

/** The bars each exercise type can be. */
export function measureLimitsFor(type: ExerciseType): { min: number; max: number } {
  return type === "ETUDES" ? ETUDE_MEASURE_LIMITS : MEASURE_LIMITS;
}

/** `measures`, moved inside the type's limits if it's outside them. */
export function measuresFor(type: ExerciseType, measures: number): number {
  const { min, max } = measureLimitsFor(type);
  return Math.min(max, Math.max(min, measures));
}

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  LONG_TONES: "Long tones",
  SCALES: "Scales",
  LIP_SLURS: "Lip slurs",
  ETUDES: "Etudes",
  RANDOM: "Random",
};

export const RANGE_LABELS: Record<Range, string> = {
  LOW: "Low",
  MED: "Medium",
  HIGH: "High",
  ANY: "Any",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  LOW: "Low",
  MED: "Medium",
  HIGH: "High",
};

/** The difficulties each exercise type comes in. Long tones have no medium. */
export const TYPE_DIFFICULTIES: Record<ExerciseType, readonly Difficulty[]> = {
  LONG_TONES: ["LOW", "HIGH"],
  SCALES: DIFFICULTIES,
  LIP_SLURS: DIFFICULTIES,
  ETUDES: DIFFICULTIES,
  RANDOM: DIFFICULTIES,
};

/** `difficulty` if the type comes in it, otherwise the type's lowest. */
export function difficultyFor(type: ExerciseType, difficulty: Difficulty): Difficulty {
  const offered = TYPE_DIFFICULTIES[type];
  return offered.includes(difficulty) ? difficulty : offered[0];
}
