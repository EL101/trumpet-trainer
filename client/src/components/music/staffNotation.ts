import { splitNotes } from "@/utils/splitNotes";

export type ParsedNote = {
  /** VexFlow key, e.g. "c#/5". */
  key: string;
  /** VexFlow duration without dots, e.g. "8". */
  duration: string;
  dotted: boolean;
  rest: boolean;
};

/**
 * Parses one token of the app's note format: "C#5/q", "G4/16.", "B4/8/r", "B4/8/r.",
 * or "A4" (duration carried over from the previous note).
 */
export function parseNote(token: string, carried: string): ParsedNote {
  const [pitch, rawDur = carried, flag = ""] = token.trim().split("/");
  const rest = flag.startsWith("r");
  const dotted = rawDur.endsWith(".") || flag.endsWith(".");
  const duration = rawDur.replace(/\.$/, "");
  const m = /^([A-Ga-g])(#|b|n)?(\d)$/.exec(pitch);
  const key = m ? `${m[1].toLowerCase()}${m[2] && m[2] !== "n" ? m[2] : ""}/${m[3]}` : "b/4";
  return { key, duration, dotted, rest };
}

/** Splits a note string into measures of parsed notes, padding the last bar with rests. */
export function parseMeasures(notes: string, timeSig: string): ParsedNote[][] {
  let carried = "q";
  return splitNotes(notes, timeSig).map((measure) =>
    measure.split(",").map((tok) => {
      const n = parseNote(tok, carried);
      carried = n.duration + (n.dotted && !n.rest ? "." : "");
      return n;
    }),
  );
}
