import { describe, expect, it } from "vitest";
import { formatExerciseMeta, formatLongDate, formatPitch, toRoman } from "./format";

describe("formatPitch", () => {
  it("turns ASCII accidentals into music symbols", () => {
    expect(formatPitch("Bb major")).toBe("B♭ major");
    expect(formatPitch("F# minor")).toBe("F♯ minor");
    expect(formatPitch("F#3")).toBe("F♯3");
  });

  it("leaves naturals and ordinary words alone", () => {
    expect(formatPitch("C major")).toBe("C major");
    expect(formatPitch("A minor")).toBe("A minor");
  });
});

describe("formatExerciseMeta", () => {
  it("puts the time signature after the key and skips missing parts", () => {
    expect(formatExerciseMeta({ keyLabel: "C major", timeSig: "4/4", bars: 8 })).toEqual([
      "C major",
      "4/4",
      "8 bars",
    ]);
    expect(formatExerciseMeta({ keyLabel: "G major", bars: 1, minutes: 6 })).toEqual([
      "G major",
      "1 bar",
      "6 min",
    ]);
  });
});

describe("toRoman", () => {
  it("numbers sections", () => {
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
  });
});

describe("formatLongDate", () => {
  it("writes the day, the month in full and the year", () => {
    expect(formatLongDate("2026-06-02T12:00:00.000Z")).toBe("2 June 2026");
  });

  it("is empty for a date that isn't one", () => {
    expect(formatLongDate("not a date")).toBe("");
  });
});
