import { describe, expect, it } from "vitest";
import { formatExerciseMeta, formatPitch, toRoman } from "./format";

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
    expect(formatExerciseMeta({ keyLabel: "G major", tempo: 96, bars: 1, minutes: 6 })).toEqual([
      "G major",
      "♩ = 96",
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
