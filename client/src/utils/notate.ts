import { DURATION_TO_BEATS } from "./splitNotes";

/** A note, or a rest when `pitch` is null, and how long it lasts in quarter notes. */
export type NoteEvent = { pitch: string | null; quarters: number };

/** A bar's length in quarter notes: 4 in 4/4 and 2/2, 3 in 3/4 and 6/8. */
export function barLength(timeSig: string): number {
  const [beats, unit] = timeSig.split("/").map(Number);
  return (beats * 4) / unit;
}

const VALUES_LONGEST_FIRST = Object.entries(DURATION_TO_BEATS).sort(([, a], [, b]) => b - a);

/** Writes a length as note values, longest first: 2.5 quarters is a half then an eighth. */
export function spellLength(quarters: number): string[] {
  const values: string[] = [];
  let left = quarters;
  while (left > 0) {
    const fit = VALUES_LONGEST_FIRST.find(([, length]) => length <= left);
    if (!fit) throw new Error(`Can't write ${quarters} quarter notes as note values`);
    values.push(fit[0]);
    left -= fit[1];
  }
  return values;
}

/** A rest of the given value, as the renderer spells it: `B4/q/r`, or `B4/q/r.` dotted. */
export function rest(value: string) {
  return value.endsWith(".") ? `B4/${value.slice(0, -1)}/r.` : `B4/${value}/r`;
}

/**
 * Writes notes out in the app's format, wherever they fall in the bar. A note that
 * crosses a bar line, or whose length no single value can show, becomes tied notes
 * (`C5/h~, C5/8`); a rest is split the same way, without ties. Rests fill out the last
 * bar.
 */
export function notate(events: readonly NoteEvent[], timeSig: string): string {
  const bar = barLength(timeSig);
  const tokens: string[] = [];
  let position = 0;

  const write = ({ pitch, quarters }: NoteEvent) => {
    const values: string[] = [];
    for (let left = quarters; left > 0; ) {
      const piece = Math.min(left, bar - (position % bar));
      values.push(...spellLength(piece));
      position += piece;
      left -= piece;
    }
    values.forEach((value, i) => {
      const tied = i < values.length - 1 ? "~" : "";
      tokens.push(pitch === null ? rest(value) : `${pitch}/${value}${tied}`);
    });
  };

  events.forEach(write);
  if (position % bar) write({ pitch: null, quarters: bar - (position % bar) });
  return tokens.join(", ");
}
