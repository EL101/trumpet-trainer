import { Note, Scale } from "tonal";
import { DURATION_TO_BEATS } from "./splitNotes";
import type { Difficulty, Key, Range } from "@/schema";

export const PRACTICAL_MAJOR = [
  "C",
  "C#",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
]; // removed D#, G#, A#

export const PRACTICAL_MINOR = [
  "C",
  "C#",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "Bb",
  "B",
]; // removed Db, Gb

const MINOR_TO_MAJOR: Record<string, string> = {
  A: "C",
  E: "G",
  B: "D",
  "F#": "A",
  "C#": "E",
  "G#": "B",
  "D#": "F#",
  "A#": "C#",
  D: "F",
  G: "Bb",
  C: "Eb",
  F: "Ab",
  Bb: "Db",
  Eb: "Gb",
  Ab: "Cb",
  Db: "E", // Fb → E (enharmonic)
  Gb: "A", // Bbb → A (enharmonic)
};

const DIFFICULTY_TO_DURATIONS = {
  LOW: Object.fromEntries(
    Object.entries(DURATION_TO_BEATS).filter(([_, v]) => v >= 0.5 && v <= 4 && v !== 0.75),
  ),
  MED: Object.fromEntries(
    Object.entries(DURATION_TO_BEATS).filter(([_, v]) => v >= 0.25 && v <= 2),
  ),
  HIGH: DURATION_TO_BEATS,
};

/** Lowest and highest written note for each range. */
export const RANGE_NOTES: Record<Range, readonly [string, string]> = {
  LOW: ["F#3", "C5"],
  MED: ["C4", "C6"],
  HIGH: ["C5", "G6"],
  ANY: ["F#3", "G6"],
};

const RANGE_THRESHOLDS = Object.fromEntries(
  Object.entries(RANGE_NOTES).map(([range, notes]) => [range, notes.map((n) => Note.midi(n))]),
) as Record<Range, (number | null)[]>;

/** Every note of the key's scale inside the range, lowest first. */
function scaleNotesInRange(key: Key, range: Range): string[] {
  const [low, high] = RANGE_THRESHOLDS[range];
  return Scale.get(key)
    .notes.flatMap((note) => [3, 4, 5, 6].map((octave) => `${note}${octave}`))
    .filter((note) => {
      const midi = Note.midi(note);
      return midi !== null && midi >= low! && midi <= high!;
    })
    .sort((a, b) => Note.midi(a)! - Note.midi(b)!);
}

/**
 * The pitches of a scale exercise: from the lowest tonic in the range up to the top of
 * the range, down to the bottom, and back up to the tonic, so every note of the key the
 * range allows is played and the scale starts and ends at home.
 */
export function scalePitches(key: Key, range: Range): string[] {
  const notes = scaleNotesInRange(key, range);
  const tonic = notes.findIndex((note) => Note.pitchClass(note) === Scale.get(key).tonic);
  const up = notes.slice(tonic);
  const down = notes.slice(0, -1).reverse();
  const backUp = notes.slice(1, tonic + 1);
  return [...up, ...down, ...backUp];
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getKeySig(key: Key) {
  const [root, quality] = key.split(" ");
  if (quality === "major") return root;
  else {
    return MINOR_TO_MAJOR[root] ?? "C";
  }
}

/** A time signature's bar length in its own beats, and the length of one beat in quarters. */
function barShape(timeSig: string) {
  const [mBeats, noteVal] = timeSig.split("/").map((s) => parseInt(s));
  return { mBeats, beat: 4 / noteVal };
}

/**
 * A random note value that fits in the `remaining` beats of the bar and doesn't leave
 * a gap too short for any other value to fill.
 */
function randomDuration(
  durations: Record<string, number>,
  remaining: number,
  beat: number,
): [string, number] {
  const values = Object.values(durations);
  const fits = (dur: number) => dur / beat <= remaining;
  const fillable = (dur: number) => {
    const left = remaining - dur / beat;
    return left === 0 || values.some((other) => other / beat <= left);
  };
  return randomElement(Object.entries(durations).filter(([_, dur]) => fits(dur) && fillable(dur)));
}

export function generateMusic(
  bars: number,
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const durations = DIFFICULTY_TO_DURATIONS[difficulty];
  const rangedScale = scaleNotesInRange(key, range);
  let currBeats = 0;
  const { mBeats, beat } = barShape(timeSig);
  let notes = "";
  while (currBeats < bars * mBeats) {
    const [val, dur] = randomDuration(durations, mBeats - (currBeats % mBeats), beat);
    currBeats += dur / beat;
    const note = randomElement([...rangedScale, "r"]);
    const next = note === "r" ? rest(val) : `${note}/${val}`;
    notes += notes ? `, ${next}` : next;
  }
  return notes;
}

/** A rest of the given value, as the renderer spells it: `B4/q/r`, or `B4/q/r.` dotted. */
function rest(val: string) {
  return val.endsWith(".") ? `B4/${val.slice(0, -1)}/r.` : `B4/${val}/r`;
}

/**
 * A scale exercise: the pitches are set by the key and range (see `scalePitches`), and
 * only the rhythm is random, drawn from the difficulty's note values. The last tonic is
 * held for the longest value left in its bar, and rests fill whatever is left after it.
 */
export function generateScaleExercise(
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const durations = DIFFICULTY_TO_DURATIONS[difficulty];
  const { mBeats, beat } = barShape(timeSig);
  const pitches = scalePitches(key, range);
  const notes: string[] = [];
  let remaining = mBeats;
  pitches.forEach((pitch, i) => {
    const last = i === pitches.length - 1;
    const [val, dur] = last
      ? longestDuration(remaining, beat)
      : randomDuration(durations, remaining, beat);
    notes.push(`${pitch}/${val}`);
    remaining = remaining - dur / beat || mBeats;
  });
  // Close the last bar here rather than leave it to splitNotes, whose padding can't fill
  // every gap (a 5/8-beat gap in 2/2 makes it throw).
  while (remaining !== mBeats) {
    const [val, dur] = longestDuration(remaining, beat);
    notes.push(rest(val));
    remaining = remaining - dur / beat || mBeats;
  }
  return notes.join(", ");
}

/** The longest single note value that fits in the `remaining` beats of the bar. */
function longestDuration(remaining: number, beat: number): [string, number] {
  return Object.entries(DURATION_TO_BEATS)
    .filter(([_, dur]) => dur / beat <= remaining)
    .reduce((longest, entry) => (entry[1] > longest[1] ? entry : longest));
}
