import { describe, expect, it } from "vitest";
import { HALF_NOTE, pulseOf } from "./meter";
import { describeNoteValue, layoutNoteValue } from "./noteValue";

describe("layoutNoteValue", () => {
  it("draws a quarter as one filled note with no beams", () => {
    const { notes, beamed } = layoutNoteValue("♩");
    expect(notes).toEqual([{ x: expect.any(Number), open: false, beams: 0, dotted: false }]);
    expect(beamed).toEqual([]);
  });

  it("draws the half note's character with a hollow head", () => {
    expect(layoutNoteValue(HALF_NOTE).notes[0]).toMatchObject({ open: true, beams: 0 });
  });

  it("puts a dot on the note before it, and makes room for it", () => {
    const quarter = layoutNoteValue("♩");
    const dotted = layoutNoteValue("♩.");
    expect(dotted.notes).toHaveLength(1);
    expect(dotted.notes[0].dotted).toBe(true);
    expect(dotted.width).toBeGreaterThan(quarter.width);
  });

  it("ignores a dot with no note before it, and characters it doesn't know", () => {
    expect(layoutNoteValue(".x").notes).toEqual([]);
  });

  it("beams eighths written side by side into one run", () => {
    const { notes, beamed } = layoutNoteValue("♪♪♪");
    expect(notes.map((n) => n.beams)).toEqual([1, 1, 1]);
    expect(beamed).toEqual([[0, 2]]);
  });

  it("draws ♬ as two sixteenths under a double beam", () => {
    const { notes, beamed } = layoutNoteValue("♬");
    expect(notes.map((n) => n.beams)).toEqual([2, 2]);
    expect(beamed).toEqual([[0, 1]]);
  });

  it("flags an eighth alone instead of beaming it, and makes room for the flag", () => {
    const eighth = layoutNoteValue("♪");
    expect(eighth.beamed).toEqual([]);
    expect(eighth.width).toBeGreaterThan(layoutNoteValue("♩").width);
  });

  it("keeps quarters apart, further than beamed notes", () => {
    const quarters = layoutNoteValue("♩♩").notes;
    const eighths = layoutNoteValue("♪♪").notes;
    expect(layoutNoteValue("♩♩").beamed).toEqual([]);
    expect(quarters[1].x - quarters[0].x).toBeGreaterThan(eighths[1].x - eighths[0].x);
  });

  it("lays out every note value the metronome offers", () => {
    for (const timeSig of ["4/4", "2/2", "6/8", "3/8"]) {
      const pulse = pulseOf(timeSig);
      for (const symbol of [pulse.symbol, ...pulse.subdivisions.map((s) => s.symbol)]) {
        const { notes, width } = layoutNoteValue(symbol);
        expect(notes.length, symbol).toBeGreaterThan(0);
        // Everything drawn stays inside the drawing.
        expect(Math.max(...notes.map((n) => n.x))).toBeLessThan(width);
      }
    }
  });
});

describe("describeNoteValue", () => {
  it("names the note values in words", () => {
    expect(describeNoteValue("♩")).toBe("quarter note");
    expect(describeNoteValue("♩.")).toBe("dotted quarter note");
    expect(describeNoteValue(HALF_NOTE)).toBe("half note");
    expect(describeNoteValue("♪")).toBe("eighth note");
    expect(describeNoteValue("♩♩")).toBe("two quarter notes");
    expect(describeNoteValue("♪♪♪")).toBe("three eighth notes");
    expect(describeNoteValue("♬")).toBe("two sixteenth notes");
  });

  it("falls back to the symbol itself when there's nothing to draw", () => {
    expect(describeNoteValue("?")).toBe("?");
  });
});
