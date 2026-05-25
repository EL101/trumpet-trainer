import { Note, Scale } from "tonal";
import { DURATION_TO_BEATS } from "./splitNotes";

export const PITCH_CLASSES = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
] as const;

export type PitchClass = (typeof PITCH_CLASSES)[number];

export type KeyQuality = "major" | "minor";
export type Key = `${PitchClass} ${KeyQuality}`;
export type Range = "LOW" | "MED" | "HIGH" | "ANY";
export type Difficulty = "LOW" | "MED" | "HIGH";

const DIFFUCULTY_TO_DURATIONS = {
  LOW: Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(DURATION_TO_BEATS).filter(([_, v]) => v >= 0.5 && v <= 4 && v !== 0.75),
  ),
  MED: Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(DURATION_TO_BEATS).filter(([_, v]) => v >= 0.25 && v <= 2),
  ),
  HIGH: DURATION_TO_BEATS,
};

const threshold = {
  LOW: [Note.midi("F#3"), Note.midi("C5")],
  MED: [Note.midi("C4"), Note.midi("C6")],
  HIGH: [Note.midi("C5"), Note.midi("G6")],
  ANY: [Note.midi("F#3"), Note.midi("G6")],
};

function generateScale(key: Key) {
  return Scale.get(key).notes;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMusic(
  bars: number,
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const durations = DIFFUCULTY_TO_DURATIONS[difficulty];
  const rawScale = generateScale(key);
  const rangedScale: string[] = [];
  const [low, high] = threshold[range];
  rawScale.forEach((note) => {
    for (let i = 3; i <= 6; i++) {
      const currNote = `${note}${i}`;
      const currMidi = Note.midi(currNote);
      if (currMidi >= low && currMidi <= high) {
        rangedScale.push(currNote);
      }
    }
  });
  let currBeats = 0;
  const [mBeats, noteVal] = timeSig.split("/").map((s) => parseInt(s));
  let notes = "";
  // console.log(bars * mBeats)
  while (currBeats < bars * mBeats) {
    const remaining = mBeats - (currBeats % mBeats);
    const validDurations = Object.entries(durations).filter(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([_, dur]) => dur / (4 / noteVal) <= remaining,
    );
    // console.log(validDurations);
    const [val, dur] = randomElement(validDurations);

    const nextBeats = currBeats + dur / (4 / noteVal);
    const nextValidDurations = Object.entries(durations).filter(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([_, dur]) => dur / (4 / noteVal) <= mBeats - (nextBeats % mBeats),
    );
    // console.log(nextValidDurations);
    // console.log(remaining);
    if (nextValidDurations.length === 0 && nextBeats !== bars * mBeats) continue;
    currBeats += dur / (4 / noteVal);
    const note = randomElement([...rangedScale, "r"]);
    if (note === "r") {
      if (val.includes(".")) {
        notes += notes ? `, B4/${val.split(".")[0]}/r.` : `B4/${val.split(".")[0]}/r.`;
      } else {
        notes += notes ? `, B4/${val}/r` : `B4/${val}/r`;
      }
    } else {
      notes += notes ? `, ${note}/${val}` : `${note}/${val}`;
    }
  }
  // console.log(notes);
  return notes;
}
