import { describe, expect, it } from "vitest";
import {
  changedRanges,
  describeChanges,
  DEFAULT_NOTE_RANGES,
  isNoteRanges,
  HORN_SPAN,
  moveEnd,
  noteName,
  RANGE_AXIS_NOTES,
  spanOf,
  toSpan,
} from "./noteRanges";

describe("the default ranges", () => {
  it("are Low F#3–C5, Medium C4–C6 and High C5–G6, on a horn from F#3 to G6", () => {
    expect(DEFAULT_NOTE_RANGES).toEqual({ LOW: [54, 72], MED: [60, 84], HIGH: [72, 91] });
    expect(HORN_SPAN).toEqual([54, 91]);
  });
});

describe("spanOf", () => {
  const mine = { LOW: [54, 70], MED: [62, 81], HIGH: [70, 88] } as const;

  it("reads the user's ranges", () => {
    expect(spanOf("MED", mine)).toEqual([62, 81]);
    expect(spanOf("LOW")).toEqual([54, 72]);
  });

  it("keeps Any as the whole horn, whatever the user's ranges", () => {
    expect(spanOf("ANY", mine)).toEqual([54, 91]);
  });
});

describe("toSpan", () => {
  it("takes a named range at its default notes, or the notes as given", () => {
    expect(toSpan("HIGH")).toEqual([72, 91]);
    expect(toSpan([60, 75])).toEqual([60, 75]);
  });
});

describe("noteName", () => {
  it("spells with sharps", () => {
    expect(noteName(54)).toBe("F#3");
    expect(noteName(70)).toBe("A#4");
    expect(noteName(91)).toBe("G6");
  });
});

describe("moveEnd", () => {
  it("moves the end asked for and leaves the other", () => {
    expect(moveEnd([60, 84], 0, 62)).toEqual([62, 84]);
    expect(moveEnd([60, 84], 1, 81)).toEqual([60, 81]);
  });

  it("stops each end an octave from the other", () => {
    expect(moveEnd([60, 84], 0, 80)).toEqual([72, 84]);
    expect(moveEnd([60, 84], 1, 61)).toEqual([60, 72]);
  });

  it("keeps both ends on the horn", () => {
    expect(moveEnd([60, 84], 0, 40)).toEqual([54, 84]);
    expect(moveEnd([60, 84], 1, 100)).toEqual([60, 91]);
  });
});

describe("changedRanges", () => {
  it("lists the ranges that differ, in order", () => {
    const edited = { ...DEFAULT_NOTE_RANGES, HIGH: [72, 88], LOW: [54, 70] } as const;
    expect(changedRanges(DEFAULT_NOTE_RANGES, edited)).toEqual(["LOW", "HIGH"]);
    expect(changedRanges(DEFAULT_NOTE_RANGES, { ...DEFAULT_NOTE_RANGES })).toEqual([]);
  });
});

describe("isNoteRanges", () => {
  it("takes ranges a user could save", () => {
    expect(isNoteRanges(DEFAULT_NOTE_RANGES)).toBe(true);
    expect(isNoteRanges({ LOW: [54, 66], MED: [70, 82], HIGH: [79, 91] })).toBe(true);
  });

  it.each([
    ["nothing", null],
    ["a range missing", { LOW: [54, 72], MED: [60, 84] }],
    ["one narrower than an octave", { ...DEFAULT_NOTE_RANGES, MED: [60, 71] }],
    ["one off the horn", { ...DEFAULT_NOTE_RANGES, HIGH: [72, 92] }],
    ["notes that aren't whole numbers", { ...DEFAULT_NOTE_RANGES, LOW: [54.5, 72] }],
    ["notes that aren't numbers", { ...DEFAULT_NOTE_RANGES, LOW: ["F#3", "C5"] }],
  ])("turns down %s", (_, value) => {
    expect(isNoteRanges(value)).toBe(false);
  });
});

describe("describeChanges", () => {
  it("names the ranges changed", () => {
    expect(describeChanges(["MED"])).toBe("Medium range changed");
    expect(describeChanges(["LOW", "HIGH"])).toBe("Low and High ranges changed");
    expect(describeChanges(["LOW", "MED", "HIGH"])).toBe("Low, Medium and High ranges changed");
    expect(describeChanges([])).toBe("");
  });
});

describe("RANGE_AXIS_NOTES", () => {
  it("is the horn's two ends and each C between", () => {
    expect(RANGE_AXIS_NOTES.map(noteName)).toEqual(["F#3", "C4", "C5", "C6", "G6"]);
    expect(RANGE_AXIS_NOTES[0]).toBe(HORN_SPAN[0]);
    expect(RANGE_AXIS_NOTES.at(-1)).toBe(HORN_SPAN[1]);
  });
});
