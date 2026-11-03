import { describe, expect, it } from "vitest";
import { barAt, buildTimeline, cursorAt, soundingNotes } from "./timeline";

describe("buildTimeline", () => {
  it("places each note after the one before it", () => {
    const t = buildTimeline("C4/q, D4, E4/h", "4/4");
    expect(t.notes.map((n) => [n.start, n.length, n.midi])).toEqual([
      [0, 1, 60],
      [1, 1, 62],
      [2, 2, 64],
    ]);
    expect(t).toMatchObject({ bar: 4, bars: 1, end: 4 });
  });

  it("lengthens dotted notes and keeps rests without a pitch", () => {
    const t = buildTimeline("G4/q., A4/8, B4/q/r, Bb4/q", "4/4");
    expect(t.notes.map((n) => [n.start, n.length, n.midi])).toEqual([
      [0, 1.5, 67],
      [1.5, 0.5, 69],
      [2, 1, null],
      [3, 1, 70],
    ]);
  });

  it("includes the rests the staff pads the last bar with", () => {
    const t = buildTimeline("C5/h", "4/4");
    expect(t.notes).toHaveLength(2);
    expect(t.notes[1].midi).toBeNull();
    expect(t.end).toBe(4);
  });

  it("measures bars in quarter notes", () => {
    const t = buildTimeline("D4/8, E4, F#4, G4, A4, B4, A4, G4, F#4", "6/8");
    expect(t).toMatchObject({ bar: 3, bars: 2, end: 6 });
  });

  it("marks notes slurred into the next, up to the slur's last note", () => {
    const t = buildTimeline("(C4/q, G4/q, C5/q), G4/q", "4/4");
    expect(t.notes.map((n) => n.slurred)).toEqual([true, true, false, false]);
  });
});

describe("cursorAt", () => {
  const t = buildTimeline("C4/q, D4, E4/h", "4/4");

  it("sits on a note as it starts and glides towards the next", () => {
    expect(cursorAt(t, 0)).toBe(0);
    expect(cursorAt(t, 1.5)).toBe(1.5);
    expect(cursorAt(t, 3)).toBe(2.5);
  });

  it("stays in range before the start and after the end", () => {
    expect(cursorAt(t, -2)).toBe(0);
    expect(cursorAt(t, 10)).toBe(3);
  });
});

describe("barAt", () => {
  const t = buildTimeline("C4/w, D4/w, E4/w", "4/4");

  it("counts bars from 0", () => {
    expect(barAt(t, 0)).toBe(0);
    expect(barAt(t, 3.99)).toBe(0);
    expect(barAt(t, 4)).toBe(1);
  });

  it("stays in range", () => {
    expect(barAt(t, -1)).toBe(0);
    expect(barAt(t, 12)).toBe(2);
  });
});

describe("soundingNotes", () => {
  it("drops rests", () => {
    const notes = soundingNotes(buildTimeline("C4/q, B4/q/r, D4/h", "4/4"));
    expect(notes.map((n) => [n.start, n.midi])).toEqual([
      [0, 60],
      [2, 62],
    ]);
  });

  it("joins tied notes into one", () => {
    const notes = soundingNotes(buildTimeline("C5/w~, C5/h~, C5/h, D5/w", "4/4"));
    expect(notes.map((n) => [n.start, n.length, n.midi])).toEqual([
      [0, 8, 72],
      [8, 4, 74],
    ]);
  });

  it("plays slurred notes legato", () => {
    const notes = soundingNotes(buildTimeline("(C4/q, G4/q), C5/h", "4/4"));
    expect(notes.map((n) => n.legato)).toEqual([true, false, false]);
  });
});
