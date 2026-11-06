import { describe, expect, it } from "vitest";
import {
  barExcerpt,
  parseMeasures,
  parseNote,
  pitchName,
  resolveMeasuresPerLine,
  spellInKey,
} from "./notation";

describe("parseNote", () => {
  it("parses pitch, duration, dots and rests", () => {
    expect(parseNote("C#5/q", "q")).toEqual({
      key: "c#/5",
      duration: "q",
      dotted: false,
      rest: false,
      tied: false,
      slurStart: false,
      slurEnd: false,
    });
    expect(parseNote("G4/16.", "q")).toEqual({
      key: "g/4",
      duration: "16",
      dotted: true,
      rest: false,
      tied: false,
      slurStart: false,
      slurEnd: false,
    });
    expect(parseNote("B4/8/r.", "q")).toEqual({
      key: "b/4",
      duration: "8",
      dotted: true,
      rest: true,
      tied: false,
      slurStart: false,
      slurEnd: false,
    });
  });

  it("carries the previous duration when omitted", () => {
    expect(parseNote(" A4", "8")).toMatchObject({ key: "a/4", duration: "8" });
  });

  it("reads a trailing ~ as a tie to the next note", () => {
    expect(parseNote("C5/h.~", "q")).toEqual({
      key: "c/5",
      duration: "h",
      dotted: true,
      rest: false,
      tied: true,
      slurStart: false,
      slurEnd: false,
    });
    expect(parseNote("A4~", "8")).toMatchObject({ key: "a/4", duration: "8", tied: true });
  });
});

describe("parseMeasures", () => {
  it("splits bars and carries durations within them", () => {
    const bars = parseMeasures("C4/h, D4, E4/q, F4", "4/4");
    expect(bars).toHaveLength(2);
    expect(bars[0].map((n) => n.duration)).toEqual(["h", "h"]);
    expect(bars[1].map((n) => n.duration)).toEqual(["q", "q", "h"]);
    expect(bars[1][2].rest).toBe(true);
  });
});

describe("parseNote with slurs", () => {
  it("reads ( as a slur's start and ) as its end, after any tie", () => {
    expect(parseNote("(C4/q", "q")).toMatchObject({ key: "c/4", slurStart: true, slurEnd: false });
    expect(parseNote("G4/q)", "q")).toMatchObject({ key: "g/4", slurStart: false, slurEnd: true });
    expect(parseNote("G4/h~)", "q")).toMatchObject({
      duration: "h",
      tied: true,
      slurEnd: true,
    });
    expect(parseNote("(A4)", "8")).toMatchObject({
      duration: "8",
      slurStart: true,
      slurEnd: true,
    });
  });
});

describe("parseMeasures with ties", () => {
  it("keeps a tie on the last note of a bar, for the first note of the next", () => {
    const bars = parseMeasures("C4/h, D4/h~, D4/q, E4/h.", "4/4");
    expect(bars).toHaveLength(2);
    expect(bars[0].map((n) => n.tied)).toEqual([false, true]);
    expect(bars[1].map((n) => n.tied)).toEqual([false, false]);
  });
});

describe("parseMeasures with dotted rests", () => {
  it("carries a dotted rest's duration, dot included, like splitNotes does", () => {
    const bars = parseMeasures("B4/8/r., C4", "3/8");
    expect(bars).toHaveLength(1);
    expect(bars[0]).toEqual([
      {
        key: "b/4",
        duration: "8",
        dotted: true,
        rest: true,
        tied: false,
        slurStart: false,
        slurEnd: false,
      },
      {
        key: "c/4",
        duration: "8",
        dotted: true,
        rest: false,
        tied: false,
        slurStart: false,
        slurEnd: false,
      },
    ]);
  });
});

describe("resolveMeasuresPerLine", () => {
  it("uses a valid request, rounded down", () => {
    expect(resolveMeasuresPerLine(2, 8)).toBe(2);
    expect(resolveMeasuresPerLine(2.7, 8)).toBe(2);
  });

  it("puts every bar on one line when the request is missing or below 1", () => {
    expect(resolveMeasuresPerLine(undefined, 8)).toBe(8);
    expect(resolveMeasuresPerLine(0, 8)).toBe(8);
    expect(resolveMeasuresPerLine(-3, 8)).toBe(8);
    expect(resolveMeasuresPerLine(0.5, 8)).toBe(8);
    expect(resolveMeasuresPerLine(Number.NaN, 0)).toBe(1);
  });
});

describe("spellInKey", () => {
  it("writes the key's own notes without an accidental", () => {
    expect(spellInKey(70, "F")).toEqual({ name: "Bb4", accidental: "", line: 3 });
    expect(spellInKey(78, "D")).toEqual({ name: "F#5", accidental: "", line: 5 });
  });

  it("marks a note outside the key, spelt the way the key leans", () => {
    expect(spellInKey(71, "F")).toEqual({ name: "B4", accidental: "n", line: 3 });
    expect(spellInKey(68, "Bb")).toEqual({ name: "Ab4", accidental: "b", line: 2.5 });
    expect(spellInKey(61, "Eb")).toEqual({ name: "Db4", accidental: "b", line: 0.5 });
    expect(spellInKey(61, "G")).toEqual({ name: "C#4", accidental: "#", line: 0 });
    expect(spellInKey(66, "C")).toEqual({ name: "Gb4", accidental: "b", line: 2 });
  });

  it("finds the octave of a note spelt across one", () => {
    expect(spellInKey(71, "Gb")).toEqual({ name: "Cb5", accidental: "", line: 3.5 });
    expect(spellInKey(60, "C#")).toEqual({ name: "B#3", accidental: "", line: -0.5 });
  });
});

describe("pitchName", () => {
  it("writes VexFlow's key as the app does, accidentals and all", () => {
    expect(pitchName(parseNote("Bb4/q", "q"))).toBe("Bb4");
    expect(pitchName(parseNote("C#5/8", "q"))).toBe("C#5");
    expect(pitchName(parseNote("G3/h/r", "q"))).toBe("G3");
  });
});

describe("barExcerpt", () => {
  it("writes one bar out on its own, with where it starts", () => {
    const notes = "C4/q, D4, E4/h, (F4/8, G4~), G4/q., B4/q/r";
    expect(barExcerpt(notes, "4/4", 1)).toEqual({
      // The staff pads the bar out with a rest.
      notes: "F4/8, G4/8, G4/q., B4/q/r, B4/8/r",
      first: 3,
    });
    expect(barExcerpt(notes, "4/4", 0).notes).toBe("C4/q, D4/q, E4/h");
  });
});
