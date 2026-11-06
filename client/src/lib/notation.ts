import { Key, Note } from "tonal";
import { splitNotes } from "@/utils/splitNotes";

export type ParsedNote = {
  /** VexFlow key, e.g. "c#/5". */
  key: string;
  /** VexFlow duration without dots, e.g. "8". */
  duration: string;
  dotted: boolean;
  rest: boolean;
  /** Tied to the next note. */
  tied: boolean;
  /** Starts a slur, which runs to the next note that ends one. */
  slurStart: boolean;
  /** Ends a slur. */
  slurEnd: boolean;
};

/**
 * Parses one token of the app's note format: "C#5/q", "G4/16.", "B4/8/r", "B4/8/r.",
 * "A4" (duration carried over from the previous note). Marks around a note: "~" after it
 * ties it to the next ("C5/h~"), "(" before it starts a slur and ")" after it (and after
 * any "~") ends one ("(C4/q", "G4/q)").
 */
export function parseNote(token: string, carried: string): ParsedNote {
  const [, open, body, tie, close] = /^(\(?)(.*?)(~?)(\)?)$/.exec(token.trim())!;
  const [pitch, rawDur = carried, flag = ""] = body.split("/");
  const rest = flag.startsWith("r");
  const dotted = rawDur.endsWith(".") || flag.endsWith(".");
  const duration = rawDur.replace(/\.$/, "");
  const m = /^([A-Ga-g])(#|b|n)?(\d)$/.exec(pitch);
  const key = m ? `${m[1].toLowerCase()}${m[2] && m[2] !== "n" ? m[2] : ""}/${m[3]}` : "b/4";
  return { key, duration, dotted, rest, tied: !!tie, slurStart: !!open, slurEnd: !!close };
}

/** Splits a note string into measures of parsed notes, padding the last bar with rests. */
export function parseMeasures(notes: string, timeSig: string): ParsedNote[][] {
  let carried = "q";
  return splitNotes(notes, timeSig).map((measure) =>
    measure.split(",").map((tok) => {
      const n = parseNote(tok, carried);
      // splitNotes carries the dot from a dotted rest too, so match it.
      carried = n.duration + (n.dotted ? "." : "");
      return n;
    }),
  );
}

/**
 * Bars per staff line. A missing value, or anything below 1, puts every bar on one line
 * (a step of 0 or less would never advance through the bars).
 */
export function resolveMeasuresPerLine(requested: number | undefined, measureCount: number) {
  if (requested != null && requested >= 1) return Math.floor(requested);
  return Math.max(1, measureCount);
}

const LETTERS = "CDEFGAB";

/** A written note spelt for a key, and where it sits on the staff. */
export type Spelling = {
  /** "Bb4", "F#5". */
  name: string;
  /** The accidental to draw by it, given the key signature: "" for none, "n" for a natural. */
  accidental: "" | "#" | "b" | "n";
  /** Its line, as VexFlow counts: 0 for middle C, 1 for the bottom line, 0.5 a step. */
  line: number;
};

/**
 * How to write a pitch (a MIDI number) in a major key signature ("F", "Bb", "C"): as
 * the key's own note if it's in the scale, otherwise with sharps in sharp keys and flats
 * in flat ones (and in C).
 */
export function spellInKey(midi: number, keySig: string): Spelling {
  const scale = Key.majorKey(keySig).scale;
  const flats = scale.some((pc) => pc.endsWith("b")) || scale.every((pc) => pc.length === 1);
  const pc =
    scale.find((p) => Note.chroma(p) === ((midi % 12) + 12) % 12) ??
    Note.pitchClass(flats ? Note.fromMidi(midi) : Note.fromMidiSharps(midi));
  const { letter, acc } = Note.get(pc);
  // Cb5 is a B4, B#3 a C4: find the octave whose note this is.
  const guess = Math.floor(midi / 12) - 1;
  const octave = [guess - 1, guess, guess + 1].find((o) => Note.midi(`${pc}${o}`) === midi)!;
  const inKey = Note.get(scale.find((p) => p[0] === letter)!).acc;
  return {
    name: `${pc}${octave}`,
    accidental: acc === inKey ? "" : acc === "" ? "n" : (acc[0] as "#" | "b"),
    line: ((octave - 4) * 7 + LETTERS.indexOf(letter)) / 2,
  };
}

/**
 * One bar of an exercise as a note string of its own (every duration written out, ties
 * and slurs left off, as they'd lead nowhere), and the index of its first note in the
 * whole exercise, rests counted. `bar` counts from 0.
 */
export function barExcerpt(notes: string, timeSig: string, bar: number) {
  const measures = parseMeasures(notes, timeSig);
  const first = measures.slice(0, bar).reduce((sum, m) => sum + m.length, 0);
  const tokens = (measures[bar] ?? []).map((n) => {
    const [name, octave] = n.key.split("/");
    const pitch = `${name[0].toUpperCase()}${name.slice(1)}${octave}`;
    return `${pitch}/${n.duration}${n.dotted ? "." : ""}${n.rest ? "/r" : ""}`;
  });
  return { notes: tokens.join(", "), first };
}
