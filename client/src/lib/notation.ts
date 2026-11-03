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
