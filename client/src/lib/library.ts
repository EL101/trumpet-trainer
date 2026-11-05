import { EXERCISE_TYPES, type ExerciseType, type LibraryEntry } from "@/schema";
import { splitNotes } from "@/utils/splitNotes";
import { formatExerciseMeta, formatPitch } from "./format";
import { EXERCISE_TYPE_LABELS, KEYLESS } from "./generatorOptions";

/** The library's type filter: every exercise, or one type. */
export type LibraryFilter = "ALL" | ExerciseType;

export function isLibraryFilter(value: unknown): value is LibraryFilter {
  return value === "ALL" || (EXERCISE_TYPES as readonly unknown[]).includes(value);
}

/**
 * How many exercises the library loads at a time: whole rows at 1, 2, 3, 4 or 6 columns,
 * and few enough that a chunk's scores draw quickly.
 */
export const LIBRARY_PAGE_SIZE = 24;

/** `entries` followed by those of `more` it doesn't already have. */
export function appendUnique<T extends { exerciseId: string }>(
  entries: readonly T[],
  more: readonly T[],
): T[] {
  const have = new Set(entries.map((e) => e.exerciseId));
  return [...entries, ...more.filter((e) => !have.has(e.exerciseId))];
}

/**
 * How many placeholder cards stand in for the next chunk: as many as it will hold, at
 * least one even if `total` is out of date, and at most a page.
 */
export function placeholderCount(loaded: number, total: number, pageSize = LIBRARY_PAGE_SIZE) {
  return Math.min(pageSize, Math.max(1, total - loaded));
}

/**
 * How long card `index` waits to come in, so a newly loaded chunk (from `chunkStart`)
 * arrives one card after another. Cards already there don't wait; the wait stops
 * growing after a dozen, so a long chunk doesn't take long to finish.
 */
export function chunkDelay(index: number, chunkStart: number, stepMs = 30): number {
  return Math.min(Math.max(0, index - chunkStart), 12) * stepMs;
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

/**
 * A card's name for screen readers, with everything the card shows by eye: "Scales No.
 * 42, B♭ minor, 4/4, 8 bars, saved 3 Nov". Numbers start again after a history clear,
 * so two cards can share one; the details tell them apart.
 */
export function cardLabel(entry: LibraryEntry, now = new Date()): string {
  // Lip slurs are stored as C major but written without a key, so they don't give one.
  const keyLabel = KEYLESS.has(entry.exerciseType) ? undefined : formatPitch(entry.musicKey);
  const saved = formatSavedDate(entry.createdAt, now);
  return [
    `${EXERCISE_TYPE_LABELS[entry.exerciseType]} No. ${entry.generationNum}`,
    ...formatExerciseMeta({
      keyLabel,
      timeSig: entry.timeSig,
      bars: splitNotes(entry.notes, entry.timeSig).length,
    }),
    saved && `saved ${saved}`,
  ]
    .filter(Boolean)
    .join(", ");
}
