import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { DIFFICULTIES, RANGES } from "@/schema";
import { TIME_SIGNATURES } from "@/lib/generatorOptions";
import {
  generateLongTones,
  generateMusic,
  generateScaleExercise,
  RANGE_NOTES,
  scalePitches,
} from "./generateMusic";
import { LONG_TONE_MELODY, withinLeap } from "./melody";
import { DURATION_TO_BEATS, splitNotes } from "./splitNotes";

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

/** The notes fill whole bars with none crossing a bar line, and ties only join a pitch to itself. */
function expectWellFormed(notes: string, timeSig: string) {
  // splitNotes throws on a note that crosses a bar line, and keeps whole bars as given.
  expect(splitNotes(notes, timeSig).join(", ")).toBe(notes);
  const tokens = notes.split(", ");
  tokens.forEach((token, i) => {
    if (!token.endsWith("~")) return;
    expect(token).not.toContain("/r");
    expect(tokens[i + 1]?.split("/")[0]).toBe(token.split("/")[0]);
  });
}

/** The pitch of each note as played: a tied note counts once, and rests are skipped. */
function playedPitches(notes: string) {
  const tokens = notes.split(", ");
  return tokens
    .filter((token, i) => !token.includes("/r") && !tokens[i - 1]?.endsWith("~"))
    .map((token) => token.split("/")[0]);
}

/** Each played note's length in quarters, its tied pieces added up. For music with no rests. */
function playedLengths(notes: string) {
  const lengths: number[] = [];
  let tied = false;
  for (const token of notes.split(", ")) {
    const value = token.split("/")[1].replace("~", "") as keyof typeof DURATION_TO_BEATS;
    if (tied) lengths[lengths.length - 1] += DURATION_TO_BEATS[value];
    else lengths.push(DURATION_TO_BEATS[value]);
    tied = token.endsWith("~");
  }
  return lengths;
}

describe("generateScaleExercise", () => {
  it("plays exactly the scale's pitches, with no rests", () => {
    const notes = generateScaleExercise("4/4", "D major", "MED", "HIGH");
    expect(playedPitches(notes)).toEqual(scalePitches("D major", "MED"));
    expect(notes).not.toContain("/r");
  });

  it.each(TIME_SIGNATURES)("fills whole bars, tying notes across bar lines, in %s", (timeSig) => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        expectWellFormed(generateScaleExercise(timeSig, "Bb major", "ANY", difficulty), timeSig);
      }
    }
  });

  it("ties notes across bar lines", () => {
    const runs = Array.from({ length: 20 }, () =>
      generateScaleExercise("4/4", "C major", "MED", "MED"),
    );
    expect(runs.some((notes) => notes.includes("~"))).toBe(true);
  });

  it("holds the last tonic through to the bar line", () => {
    for (let run = 0; run < 50; run++) {
      const notes = generateScaleExercise("3/4", "C major", "MED", "HIGH");
      expect(notes.split(", ").at(-1)).toMatch(/^C4\/[^~]*$/);
    }
  });

  it("only uses sixteenths in pairs, or after a dotted eighth, at medium difficulty", () => {
    let pairs = 0;
    for (let run = 0; run < 50; run++) {
      // The last tonic is held to the bar line, whatever length that leaves it.
      const lengths = playedLengths(generateScaleExercise("4/4", "C major", "ANY", "MED"));
      lengths.pop();
      for (let i = 0; i < lengths.length; i++) {
        if (lengths[i] !== 0.25 || lengths[i - 1] === 0.75) continue;
        expect(lengths[i + 1]).toBe(0.25);
        pairs++;
        i++;
      }
    }
    expect(pairs).toBeGreaterThan(0);
  });

  it.each(["4/4", "6/8"])(
    "never writes dotted sixteenths or thirty-seconds at medium difficulty in %s",
    (timeSig) => {
      for (let run = 0; run < 50; run++) {
        const notes = generateScaleExercise(timeSig, "C major", "ANY", "MED");
        expect(notes).not.toMatch(/\/16\.|\/32/);
      }
    },
  );

  it("only uses easy note values at low difficulty", () => {
    for (const token of generateScaleExercise("4/4", "C major", "ANY", "LOW").split(", ")) {
      expect(["w", "h", "q", "8", "h.", "q."]).toContain(token.split("/")[1].replace("~", ""));
    }
  });
});

describe("generateMusic", () => {
  it.each(TIME_SIGNATURES)("fills exactly the bars asked for in %s", (timeSig) => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        const notes = generateMusic(5, timeSig, "F major", "MED", difficulty);
        expectWellFormed(notes, timeSig);
        expect(splitNotes(notes, timeSig)).toHaveLength(5);
      }
    }
  });

  it("ties notes across bar lines", () => {
    const runs = Array.from({ length: 20 }, () => generateMusic(4, "4/4", "C major", "MED", "LOW"));
    expect(runs.some((notes) => notes.includes("~"))).toBe(true);
  });

  it.each([
    ["LOW", 7],
    ["MED", 12],
    ["HIGH", 19],
  ] as const)("keeps leaps at %s difficulty within %i semitones", (difficulty, max) => {
    const leaps: number[] = [];
    for (let run = 0; run < 50; run++) {
      const midis = playedPitches(generateMusic(8, "4/4", "C major", "ANY", difficulty)).map(
        (pitch) => Note.midi(pitch)!,
      );
      midis.slice(1).forEach((midi, i) => leaps.push(Math.abs(midi - midis[i])));
    }
    expect(Math.max(...leaps)).toBeLessThanOrEqual(max);
    // The limit is reached, not undercut: the widest leaps allowed do turn up.
    expect(Math.max(...leaps)).toBeGreaterThanOrEqual(max - 1);
  });

  it("never leaps a tritone at low difficulty", () => {
    for (let run = 0; run < 50; run++) {
      const midis = playedPitches(generateMusic(8, "4/4", "C major", "ANY", "LOW")).map(
        (pitch) => Note.midi(pitch)!,
      );
      midis.slice(1).forEach((midi, i) => expect(Math.abs(midi - midis[i])).not.toBe(6));
    }
  });

  it("ends on the tonic", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        const tokens = generateMusic(2, "3/4", "Eb major", "MED", difficulty).split(", ");
        expect(tokens.at(-1)).not.toContain("/r");
        expect(Note.pitchClass(tokens.at(-1)!.split("/")[0])).toBe("Eb");
      }
    }
  });

  it("keeps to the key and range", () => {
    const [low, high] = RANGE_NOTES.LOW.map((n) => Note.midi(n)!);
    for (const pitch of playedPitches(generateMusic(8, "4/4", "G major", "LOW", "MED"))) {
      expect(Note.midi(pitch)).toBeGreaterThanOrEqual(low);
      expect(Note.midi(pitch)).toBeLessThanOrEqual(high);
      expect(["G", "A", "B", "C", "D", "E", "F#"]).toContain(Note.pitchClass(pitch));
    }
  });
});

describe("generateLongTones", () => {
  it.each(TIME_SIGNATURES)("fills exactly the bars asked for, with no rests, in %s", (timeSig) => {
    for (const difficulty of ["LOW", "HIGH"] as const) {
      for (let run = 0; run < 50; run++) {
        const notes = generateLongTones(3, timeSig, "Bb major", "MED", difficulty);
        expectWellFormed(notes, timeSig);
        expect(splitNotes(notes, timeSig)).toHaveLength(3);
        expect(notes).not.toContain("/r");
      }
    }
  });

  it("only uses whole notes at low difficulty", () => {
    for (let run = 0; run < 50; run++) {
      const lengths = playedLengths(generateLongTones(8, "4/4", "C major", "MED", "LOW"));
      expect(lengths.every((length) => length === 4)).toBe(true);
    }
  });

  it("uses whole and half notes at high, ending on a note at least a whole note long", () => {
    let halves = 0;
    for (let run = 0; run < 50; run++) {
      const lengths = playedLengths(generateLongTones(8, "4/4", "C major", "MED", "HIGH"));
      const last = lengths.pop()!;
      expect(last).toBeGreaterThanOrEqual(4);
      expect(lengths.every((length) => length === 4 || length === 2)).toBe(true);
      halves += lengths.filter((length) => length === 2).length;
    }
    expect(halves).toBeGreaterThan(0);
  });

  it("keeps to the difficulty's leap and ends on the tonic", () => {
    for (const difficulty of ["LOW", "HIGH"] as const) {
      for (let run = 0; run < 50; run++) {
        const pitches = playedPitches(generateLongTones(8, "4/4", "D major", "ANY", difficulty));
        const midis = pitches.map((pitch) => Note.midi(pitch)!);
        midis.slice(1).forEach((midi, i) => {
          expect(withinLeap(midi - midis[i], LONG_TONE_MELODY[difficulty])).toBe(true);
        });
        expect(Note.pitchClass(pitches.at(-1)!)).toBe("D");
      }
    }
  });
});
