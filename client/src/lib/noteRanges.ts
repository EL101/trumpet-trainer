import { Note } from "tonal";
import type { Range } from "@/schema";
import { RANGE_LABELS } from "./generatorOptions";

/**
 * Lowest and highest written note for each range, by default. Low, Medium and High can
 * be redefined in the user's settings (`NoteRanges`); Any is always the whole horn.
 * server/src/etudes/music.ts keeps a copy for etudes.
 */
export const RANGE_NOTES: Record<Range, readonly [string, string]> = {
  LOW: ["F#3", "C5"],
  MED: ["C4", "C6"],
  HIGH: ["C5", "G6"],
  ANY: ["F#3", "G6"],
};

/** A range's lowest and highest written note, as MIDI numbers. */
export type NoteSpan = readonly [low: number, high: number];

/** The ranges a user can redefine. Any is always the whole horn. */
export const SETTABLE_RANGES = ["LOW", "MED", "HIGH"] as const;
export type SettableRange = (typeof SETTABLE_RANGES)[number];

/** What Low, Medium and High cover for one user. */
export type NoteRanges = Record<SettableRange, NoteSpan>;

/** How narrow a range can be made: an octave, so every key's tonic falls inside it. */
export const MIN_RANGE_SPAN = 12;

const spanOfNotes = ([low, high]: readonly [string, string]): NoteSpan => [
  Note.midi(low)!,
  Note.midi(high)!,
];

/** The whole horn, F#3 to G6: every range has to stay inside it. */
export const HORN_SPAN = spanOfNotes(RANGE_NOTES.ANY);

/**
 * The notes labelled under a range slider's axis: the horn's two ends and each C
 * between them (F#3, C4, C5, C6, G6).
 */
export const RANGE_AXIS_NOTES: readonly number[] = [
  HORN_SPAN[0],
  ...["C4", "C5", "C6"].map((note) => Note.midi(note)!),
  HORN_SPAN[1],
];

/** What the ranges cover for a user who hasn't changed them. */
export const DEFAULT_NOTE_RANGES: NoteRanges = {
  LOW: spanOfNotes(RANGE_NOTES.LOW),
  MED: spanOfNotes(RANGE_NOTES.MED),
  HIGH: spanOfNotes(RANGE_NOTES.HIGH),
};

/** The notes a range covers, given what the user's ranges are. */
export function spanOf(range: Range, ranges: NoteRanges = DEFAULT_NOTE_RANGES): NoteSpan {
  return range === "ANY" ? HORN_SPAN : ranges[range];
}

/** A range's span: a named one at its default notes, or the notes themselves. */
export const toSpan = (range: Range | NoteSpan): NoteSpan =>
  typeof range === "string" ? spanOf(range) : range;

/** A MIDI number as a written pitch, spelt with sharps: 54 is "F#3". */
export const noteName = (midi: number) => Note.fromMidiSharps(midi);

/**
 * `span` with one end (0 the bottom, 1 the top) moved to `midi`, kept on the horn and
 * at least `MIN_RANGE_SPAN` from the other end, which never moves.
 */
export function moveEnd(span: NoteSpan, end: 0 | 1, midi: number): NoteSpan {
  const [low, high] = span;
  if (end === 0) {
    return [Math.min(Math.max(midi, HORN_SPAN[0]), high - MIN_RANGE_SPAN), high];
  }
  return [low, Math.max(Math.min(midi, HORN_SPAN[1]), low + MIN_RANGE_SPAN)];
}

const sameSpan = (a: NoteSpan, b: NoteSpan) => a[0] === b[0] && a[1] === b[1];

/** The ranges that differ between `a` and `b`, in Low, Medium, High order. */
export const changedRanges = (a: NoteRanges, b: NoteRanges): SettableRange[] =>
  SETTABLE_RANGES.filter((range) => !sameSpan(a[range], b[range]));

/** Whether `value` is a set of ranges a user could save: each on the horn, an octave wide. */
export function isNoteRanges(value: unknown): value is NoteRanges {
  if (typeof value !== "object" || value === null) return false;
  return SETTABLE_RANGES.every((range) => {
    const span: unknown = (value as Record<string, unknown>)[range];
    if (!Array.isArray(span) || span.length !== 2) return false;
    const [low, high] = span as unknown[];
    return (
      Number.isInteger(low) &&
      Number.isInteger(high) &&
      (low as number) >= HORN_SPAN[0] &&
      (high as number) <= HORN_SPAN[1] &&
      (high as number) - (low as number) >= MIN_RANGE_SPAN
    );
  });
}

/** "Medium range changed", "Low and High ranges changed", "Low, Medium and High …". */
export function describeChanges(changed: readonly SettableRange[]): string {
  const names = changed.map((range) => RANGE_LABELS[range]);
  if (names.length === 0) return "";
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list} range${names.length === 1 ? "" : "s"} changed`;
}
