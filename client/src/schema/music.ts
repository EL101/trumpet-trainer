/** Core musical vocabulary shared by the generator, the renderer and the API layer. */

export const PITCH_CLASSES = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
] as const;

export type PitchClass = (typeof PITCH_CLASSES)[number];

export type KeyQuality = "major" | "minor";
export type Key = `${PitchClass} ${KeyQuality}`;

export const RANGES = ["LOW", "MED", "HIGH", "ANY"] as const;
export type Range = (typeof RANGES)[number];

export const DIFFICULTIES = ["LOW", "MED", "HIGH"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
