import type { Dispatch, SetStateAction } from "react";
import type { Difficulty, Key, Range } from "./music";

/** A generated exercise, as stored in history and in the library. */
export type MusicInfo = {
  id: string;
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

/** Props every exercise-type form (Random, Etudes, ...) receives from Generate. */
export type ExerciseProps = {
  setTimeSig: Dispatch<SetStateAction<string>>;
  setMeasures: Dispatch<SetStateAction<number>>;
  setKey: Dispatch<SetStateAction<Key>>;
  setRange: Dispatch<SetStateAction<Range>>;
  setDifficulty: Dispatch<SetStateAction<Difficulty>>;
};

/** Body sent to POST /api/history and POST /api/library. Mirrors the server's ExerciseInputSchema. */
export type ExerciseInput = {
  notes: string;
  timeSig: string;
  musicKey: Key;
  noteRange: Range;
  difficulty: Difficulty;
  generationNum: number;
};

export function toExerciseInput(exercise: MusicInfo): ExerciseInput {
  return {
    notes: exercise.notes,
    timeSig: exercise.timeSig,
    musicKey: exercise.musicKey,
    noteRange: exercise.noteRange,
    difficulty: exercise.difficulty,
    generationNum: exercise.generationNum,
  };
}
