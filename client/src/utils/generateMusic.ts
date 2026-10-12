import { Note, Scale } from "tonal";
import { barLength, notate } from "./notate";
import { LONG_TONE_MELODY, melody, RANDOM_MELODY } from "./melody";
import { figureLength, randomFigure, rhythmFor } from "./rhythm";
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
export function scaleNotesInRange(key: Key, range: Range): string[] {
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

export function getKeySig(key: Key) {
  const [root, quality] = key.split(" ");
  if (quality === "major") return root;
  else {
    return MINOR_TO_MAJOR[root] ?? "C";
  }
}

/**
 * Random notes and rests from the key's scale. They're laid end to end over the whole
 * length, wherever the bar lines fall, so a note can be tied across one. The melody is
 * shaped by `RANDOM_MELODY` and ends on the tonic.
 */
export function generateMusic(
  bars: number,
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const rhythm = rhythmFor(timeSig, difficulty);
  const pitches = scaleNotesInRange(key, range);
  const total = bars * barLength(timeSig);
  const lengths: number[] = [];
  for (let position = 0; position < total; ) {
    const figure = randomFigure(rhythm, position, { left: total - position });
    lengths.push(...figure);
    position += figureLength(figure);
  }
  // A rest is as likely as any one pitch in the range.
  const restChance = 1 / (pitches.length + 1);
  const tonic = Scale.get(key).tonic!;
  return notate(melody(lengths, pitches, tonic, RANDOM_MELODY[difficulty], restChance), timeSig);
}

const WHOLE = 4;

/** The note lengths, in quarters, long tones are made of at each of their difficulties. */
const LONG_TONE_LENGTHS: Record<keyof typeof LONG_TONE_MELODY, number[]> = {
  LOW: [WHOLE],
  HIGH: [WHOLE, 2],
};

/**
 * Long tones, at low or high difficulty (there's no medium): whole notes, and half notes
 * at high, with no rests, over the bars asked for. The last note is the tonic, held
 * through to the end, so it's never shorter than a whole note unless the whole exercise
 * is. The melody is shaped by `LONG_TONE_MELODY`.
 */
export function generateLongTones(
  bars: number,
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: keyof typeof LONG_TONE_MELODY = "LOW",
) {
  const options = LONG_TONE_LENGTHS[difficulty];
  const lengths: number[] = [];
  for (let left = bars * barLength(timeSig); left > 0; ) {
    const length = options[Math.floor(Math.random() * options.length)];
    const quarters = left - length < WHOLE ? left : length;
    lengths.push(quarters);
    left -= quarters;
  }
  const pitches = scaleNotesInRange(key, range);
  const tonic = Scale.get(key).tonic!;
  return notate(melody(lengths, pitches, tonic, LONG_TONE_MELODY[difficulty]), timeSig);
}

/**
 * A scale exercise: the pitches are set by the key and range (see `scalePitches`), and
 * only the rhythm is random, built from the difficulty's figures (see `rhythmFor`) with
 * no regard for bar lines. The last tonic is held through to the next bar line.
 */
export function generateScaleExercise(
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const rhythm = rhythmFor(timeSig, difficulty);
  const pitches = scalePitches(key, range);
  // Every note but the last tonic, which is held to the bar line instead.
  const lengths: number[] = [];
  let position = 0;
  while (lengths.length < pitches.length - 1) {
    const maxNotes = pitches.length - 1 - lengths.length;
    const figure = randomFigure(rhythm, position, { maxNotes });
    lengths.push(...figure);
    position += figureLength(figure);
  }
  const bar = barLength(timeSig);
  lengths.push(bar - (position % bar));
  return notate(
    pitches.map((pitch, i) => ({ pitch, quarters: lengths[i] })),
    timeSig,
  );
}
