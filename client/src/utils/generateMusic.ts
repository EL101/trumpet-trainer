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

const RANGE_THRESHOLDS = {
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

export function getKeySig(key: Key) {
  const [root, quality] = key.split(" ");
  if (quality === "major") return root;
  else {
    return MINOR_TO_MAJOR[root] ?? "C";
  }
}

export function generateMusic(
  bars: number,
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const durations = DIFFICULTY_TO_DURATIONS[difficulty];
  const rawScale = generateScale(key);
  const rangedScale: string[] = [];
  const [low, high] = RANGE_THRESHOLDS[range];
  rawScale.forEach((note) => {
    for (let i = 3; i <= 6; i++) {
      const currNote = `${note}${i}`;
      const currMidi = Note.midi(currNote);
      if (currMidi && currMidi >= low! && currMidi <= high!) {
        rangedScale.push(currNote);
      }
    }
  });
  let currBeats = 0;
  const [mBeats, noteVal] = timeSig.split("/").map((s) => parseInt(s));
  let notes = "";
  while (currBeats < bars * mBeats) {
    const remaining = mBeats - (currBeats % mBeats);
    const validDurations = Object.entries(durations).filter(
      ([_, dur]) => dur / (4 / noteVal) <= remaining,
    );
    const [val, dur] = randomElement(validDurations);

    const nextBeats = currBeats + dur / (4 / noteVal);
    const nextValidDurations = Object.entries(durations).filter(
      ([_, dur]) => dur / (4 / noteVal) <= mBeats - (nextBeats % mBeats),
    );
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
  return notes;
}
