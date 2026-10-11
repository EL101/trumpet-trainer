import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { DIFFICULTIES, RANGES } from "@/schema";
import { TIME_SIGNATURES } from "@/lib/generatorOptions";
import { generateScaleExercise, RANGE_NOTES, scalePitches } from "./generateMusic";
import { splitNotes } from "./splitNotes";

const pitchesOf = (notes: string) => notes.split(", ").map((note) => note.split("/")[0]);

describe("scalePitches", () => {
  it("climbs and comes back down when the range starts on the tonic", () => {
    expect(scalePitches("C major", "MED")).toEqual([
      ...["C4", "D4", "E4", "F4", "G4", "A4", "B4"],
      ...["C5", "D5", "E5", "F5", "G5", "A5", "B5"],
      "C6",
      ...["B5", "A5", "G5", "F5", "E5", "D5", "C5"],
      ...["B4", "A4", "G4", "F4", "E4", "D4", "C4"],
    ]);
  });

  it("goes below the tonic to the bottom of the range, then back up to it", () => {
    expect(scalePitches("C major", "LOW")).toEqual([
      ...["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
      ...["B4", "A4", "G4", "F4", "E4", "D4", "C4", "B3", "A3", "G3"],
      ...["A3", "B3", "C4"],
    ]);
  });

  it("uses the natural minor scale", () => {
    expect(scalePitches("A minor", "LOW").slice(0, 8)).toEqual([
      ...["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"],
    ]);
  });

  it("spells notes for the key and keeps them in pitch order", () => {
    const pitches = scalePitches("Gb major", "MED");
    expect(pitches).toContain("Cb5");
    const top = pitches.indexOf("Gb5");
    const climb = pitches.slice(0, top + 1).map((p) => Note.midi(p)!);
    expect(climb).toEqual([...climb].sort((a, b) => a - b));
  });

  it.each(RANGES)("starts and ends on the tonic and stays inside the %s range", (range) => {
    const [low, high] = RANGE_NOTES[range].map((n) => Note.midi(n)!);
    for (const key of ["C major", "F major", "D major", "Eb minor", "C# major"] as const) {
      const pitches = scalePitches(key, range);
      const tonic = key.split(" ")[0];
      expect(Note.pitchClass(pitches[0])).toBe(tonic);
      expect(Note.pitchClass(pitches.at(-1)!)).toBe(tonic);
      expect(pitches[0]).toBe(pitches.at(-1));
      for (const pitch of pitches) {
        expect(Note.midi(pitch)).toBeGreaterThanOrEqual(low);
        expect(Note.midi(pitch)).toBeLessThanOrEqual(high);
      }
    }
  });
});

describe("generateScaleExercise", () => {
  it("plays exactly the scale's pitches", () => {
    const notes = generateScaleExercise("4/4", "D major", "MED", "HIGH");
    const played = notes.split(", ").filter((note) => !note.includes("/r"));
    expect(pitchesOf(played.join(", "))).toEqual(scalePitches("D major", "MED"));
  });

  it.each(TIME_SIGNATURES)("fills whole bars, with no note across a bar line, in %s", (timeSig) => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        const notes = generateScaleExercise(timeSig, "Bb major", "ANY", difficulty);
        // splitNotes throws on a note that crosses a bar line, and keeps whole bars as given.
        expect(splitNotes(notes, timeSig).join(", ")).toBe(notes);
      }
    }
  });

  it("ends on the held tonic, with only rests after it", () => {
    for (let run = 0; run < 50; run++) {
      const notes = generateScaleExercise("4/4", "C major", "MED", "HIGH");
      const lastBar = splitNotes(notes, "4/4").at(-1)!.split(", ");
      const tonic = lastBar.findIndex((note) => note.startsWith("C4/"));
      expect(tonic).toBeGreaterThanOrEqual(0);
      expect(lastBar.slice(tonic + 1).every((note) => note.includes("/r"))).toBe(true);
    }
  });

  it("only uses easy note values at low difficulty, apart from the held last note", () => {
    const notes = generateScaleExercise("4/4", "C major", "ANY", "LOW").split(", ").slice(0, -1);
    for (const note of notes) {
      expect(["w", "h", "q", "8", "w.", "h.", "q."]).toContain(note.split("/")[1]);
    }
  });
});
