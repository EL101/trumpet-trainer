import { HALF_NOTE } from "./meter";

/**
 * Note values (♩, ♪♪, ♬, ♩.) laid out to be drawn. The app's fonts have no music
 * characters, and the system fonts that stand in for them space them unevenly (♩ is a
 * full em wide on macOS, ♪ half that), so NoteValue draws them instead. Units are a
 * 20-unit-tall drawing, which NoteValue scales to the text's height.
 */

/** One note: where its head sits, and how it's drawn. */
export type DrawnNote = {
  /** The head's centre across. Its stem rises from `x + STEM_OFFSET`. */
  x: number;
  /** A hollow head, as on a half note. */
  open: boolean;
  /** Beams (or flags, on a note alone): 1 for an eighth, 2 for a sixteenth. */
  beams: number;
  dotted: boolean;
};

export type NoteValueLayout = {
  notes: DrawnNote[];
  /** Runs of beamed notes, as [first, last] indexes. A flagged note alone isn't one. */
  beamed: [number, number][];
  width: number;
};

/** The head's half-width, and how far right of its centre the stem stands. */
export const HEAD_RX = 3.4;
export const STEM_OFFSET = 3.1;
/** How far a flag reaches right of its stem, and a dot right of its head's centre. */
const FLAG_REACH = 4;
export const DOT_OFFSET = 6.6;
const DOT_R = 1.2;
/** Head to head: within a beamed run, and between notes that stand apart. */
const BEAMED_STEP = 8;
const APART_STEP = 10;

/** What each character stands for: "♬" is two sixteenths beamed together. */
const GLYPHS: Record<string, { open: boolean; beams: number; count: number }> = {
  "♩": { open: false, beams: 0, count: 1 },
  [HALF_NOTE]: { open: true, beams: 0, count: 1 },
  "♪": { open: false, beams: 1, count: 1 },
  "♬": { open: false, beams: 2, count: 2 },
};

/** Lays out a note value as written in `lib/meter`: "♩", "♩.", "♪♪♪", "♬". */
export function layoutNoteValue(symbol: string): NoteValueLayout {
  const notes: DrawnNote[] = [];
  const beamed: [number, number][] = [];
  let x = HEAD_RX;
  let right = 0;
  for (const char of symbol) {
    if (char === ".") {
      const last = notes.at(-1);
      if (last) {
        last.dotted = true;
        right = Math.max(right, last.x + DOT_OFFSET + DOT_R);
      }
      continue;
    }
    const glyph = GLYPHS[char];
    if (!glyph) continue;
    for (let i = 0; i < glyph.count; i++) {
      const prev = notes.at(-1);
      const joins = !!prev && prev.beams > 0 && glyph.beams > 0 && !prev.dotted;
      if (prev) x = prev.x + (joins ? BEAMED_STEP : APART_STEP);
      notes.push({ x, open: glyph.open, beams: glyph.beams, dotted: false });
      const index = notes.length - 1;
      const run = beamed.at(-1);
      if (joins && run && run[1] === index - 1) run[1] = index;
      else if (joins) beamed.push([index - 1, index]);
      right = Math.max(right, x + HEAD_RX, x + STEM_OFFSET + 0.6);
    }
  }
  // A note alone with beams wears them as flags, which reach past its stem.
  notes.forEach((note, i) => {
    if (note.beams > 0 && !beamed.some(([a, b]) => i >= a && i <= b)) {
      right = Math.max(right, note.x + STEM_OFFSET + FLAG_REACH);
    }
  });
  return { notes, beamed, width: Math.ceil(right + 0.5) };
}

const VALUE_NAMES = ["quarter", "eighth", "sixteenth"];
const COUNTS = ["", "", "two ", "three ", "four "];

/** Words for a screen reader: "dotted quarter note", "two eighth notes". */
export function describeNoteValue(symbol: string) {
  const { notes } = layoutNoteValue(symbol);
  if (!notes.length) return symbol;
  const [first] = notes;
  const value = first.open ? "half" : (VALUE_NAMES[first.beams] ?? "short");
  const many = notes.length > 1;
  return `${COUNTS[notes.length] ?? `${notes.length} `}${first.dotted ? "dotted " : ""}${value} note${many ? "s" : ""}`;
}
