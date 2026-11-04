import { EXERCISE_TYPES, type ExerciseType, type MusicInfo } from "@/schema";
import { splitNotes } from "@/utils/splitNotes";
import { formatPitch } from "./format";
import { EXERCISE_TYPE_LABELS, KEYLESS } from "./generatorOptions";

/** The library's type filter: every exercise, or one type. */
export type LibraryFilter = "ALL" | ExerciseType;

export function isLibraryFilter(value: unknown): value is LibraryFilter {
  return value === "ALL" || (EXERCISE_TYPES as readonly unknown[]).includes(value);
}

/** What a search can find an exercise by: its type, key, number and time signature. */
function searchText(exercise: MusicInfo): string {
  const parts = [
    EXERCISE_TYPE_LABELS[exercise.exerciseType],
    `No. ${exercise.generationNum}`,
    exercise.timeSig,
  ];
  // Lip slurs are stored as C major but written without a key, so they don't show one.
  if (!KEYLESS.has(exercise.exerciseType)) {
    parts.push(exercise.musicKey, formatPitch(exercise.musicKey));
  }
  return parts.join(" ").toLowerCase();
}

/**
 * The exercises of the chosen type whose details contain every word searched for, in
 * any order: "bb minor" and "minor B♭" both find B♭ minor, "42" finds No. 42.
 */
export function filterLibrary<T extends MusicInfo>(
  entries: readonly T[],
  filter: LibraryFilter,
  query: string,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (filter === "ALL" || entry.exerciseType === filter) &&
      words.every((word) => searchText(entry).includes(word)),
  );
}

/** "1 exercise", "24 exercises". */
export function countLabel(n: number): string {
  return `${n} ${n === 1 ? "exercise" : "exercises"}`;
}

/**
 * The index of the last card in the row that holds card `index`, in a grid `columns`
 * wide with `count` cards. The open card's panel goes in after it, under its row.
 */
export function rowEnd(index: number, columns: number, count: number): number {
  const cols = Math.max(1, Math.floor(columns));
  return Math.min(count - 1, Math.floor(index / cols) * cols + cols - 1);
}

/** The opening bars of an exercise, for a card's incipit. */
export function incipit(notes: string, timeSig: string, bars = 1): string {
  return splitNotes(notes, timeSig).slice(0, bars).join(", ");
}

/** When an exercise was saved, short: "3 Nov", or "3 Nov 2025" from another year. */
export function formatSavedDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
