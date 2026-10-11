import type { Difficulty, Key, Range } from "./music";

/** The kinds of exercise the generator makes. Mirrors the server's ExerciseType enum. */
export const EXERCISE_TYPES = ["LONG_TONES", "SCALES", "LIP_SLURS", "ETUDES", "RANDOM"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** History entries the server keeps per user. Mirrors the server's HISTORY_LIMIT. */
export const HISTORY_LIMIT = 100;

/** A generated exercise, as stored in history and in the library. */
export type MusicInfo = {
  id: string;
  exerciseType: ExerciseType;
  notes: string;
  timeSig: string;
  musicKey: Key;
  noteRange: Range;
  difficulty: Difficulty;
  generationNum: number;
};

/** A library row - a saved MusicInfo, with the time it was saved. */
export type LibraryEntry = MusicInfo & {
  createdAt: string;
};

/** The knobs that drive generation. */
export type ExerciseParams = {
  timeSig: string;
  measures: number;
  musicKey: Key;
  noteRange: Range;
  difficulty: Difficulty;
};

/** Body sent to POST /api/history and POST /api/library. Mirrors the server's ExerciseInputSchema. */
export type ExerciseInput = {
  exerciseType: ExerciseType;
  notes: string;
  timeSig: string;
  musicKey: Key;
  noteRange: Range;
  difficulty: Difficulty;
  generationNum: number;
};

export function toExerciseInput(exercise: MusicInfo): ExerciseInput {
  return {
    exerciseType: exercise.exerciseType,
    notes: exercise.notes,
    timeSig: exercise.timeSig,
    musicKey: exercise.musicKey,
    noteRange: exercise.noteRange,
    difficulty: exercise.difficulty,
    generationNum: exercise.generationNum,
  };
}
