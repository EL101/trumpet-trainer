import { Note } from "tonal";
import { barQuarters, pulseOf } from "./meter";
import { parseMeasures, type ParsedNote } from "./notation";

/** Note lengths in quarter notes, by VexFlow duration. */
const QUARTERS: Record<string, number> = { w: 4, h: 2, q: 1, "8": 0.5, "16": 0.25, "32": 0.125 };

/** One note or rest of an exercise, placed in time. Positions and lengths are in quarter notes. */
export type TimedNote = {
  start: number;
  length: number;
  /** Written pitch as a MIDI number; null for a rest. */
  midi: number | null;
  /** Tied to the next note, so the two sound as one. */
  tied: boolean;
  /** Slurred into the next note, so it isn't tongued apart from it. */
  slurred: boolean;
};

export type Timeline = {
  /** Every note and rest in the order the staff draws them: an index here is a cursor index there. */
  notes: TimedNote[];
  /** A bar's length. */
  bar: number;
  /** Bars, counting the last one, which the staff pads out with rests. */
  bars: number;
  /** Where the music ends. */
  end: number;
};

/** A note to play: rests dropped, and notes tied together joined into one. */
export type SoundingNote = {
  start: number;
  length: number;
  /** Written pitch as a MIDI number. */
  midi: number;
  /** Slurred into the next note. */
  legato: boolean;
};

/** Places an exercise's notes in time, from the same parse the staff draws. */
export function buildTimeline(notes: string, timeSig: string): Timeline {
  const measures = parseMeasures(notes, timeSig);
  const timed: TimedNote[] = [];
  let start = 0;
  let inSlur = false;
  for (const note of measures.flat()) {
    const length = QUARTERS[note.duration] * (note.dotted ? 1.5 : 1);
    if (note.slurStart) inSlur = true;
    timed.push({
      start,
      length,
      midi: note.rest ? null : midiOf(note),
      tied: note.tied,
      slurred: inSlur && !note.slurEnd,
    });
    if (note.slurEnd) inSlur = false;
    start += length;
  }
  return {
    notes: timed,
    bar: barQuarters(pulseOf(timeSig)),
    bars: measures.length,
    end: start,
  };
}

/**
 * The staff cursor at a position: the index of the note sounding there, plus how far
 * through it the position is, so the cursor glides from one note to the next.
 */
export function cursorAt({ notes }: Timeline, position: number): number {
  if (!notes.length) return 0;
  // The last note starting at or before the position.
  let lo = 0;
  let hi = notes.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (notes[mid].start <= position) lo = mid;
    else hi = mid - 1;
  }
  const note = notes[lo];
  return lo + Math.min(1, Math.max(0, (position - note.start) / note.length));
}

/** The bar a position falls in, counting from 0. */
export function barAt({ bar, bars }: Timeline, position: number): number {
  // A hair of slack so a position a rounding error short of a barline counts as on it.
  return Math.min(bars - 1, Math.max(0, Math.floor(position / bar + 1e-9)));
}

/** The notes to play, in order. */
export function soundingNotes({ notes }: Timeline): SoundingNote[] {
  const sounding: SoundingNote[] = [];
  // The last note, while it's tied into the next.
  let held: SoundingNote | null = null;
  for (const note of notes) {
    if (note.midi === null) {
      held = null;
      continue;
    }
    if (held && held.midi === note.midi) {
      held.length += note.length;
      held.legato = note.slurred;
    } else {
      held = { start: note.start, length: note.length, midi: note.midi, legato: note.slurred };
      sounding.push(held);
    }
    if (!note.tied) held = null;
  }
  return sounding;
}

function midiOf(note: ParsedNote) {
  const [name, octave] = note.key.split("/");
  return Note.midi(`${name}${octave}`);
}
