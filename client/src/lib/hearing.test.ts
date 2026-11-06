import { describe, expect, it } from "vitest";
import { heardPitch, isVoiced, writtenPitch } from "./hearing";
import { CONCERT_OFFSET } from "./tuning";

/** The concert frequency of a written MIDI pitch. */
const hzOf = (written: number) => 440 * 2 ** ((written + CONCERT_OFFSET - 69) / 12);

describe("writtenPitch", () => {
  it("reads a frequency as the written pitch, with the trumpet's transposition", () => {
    expect(writtenPitch(hzOf(60))).toBeCloseTo(60, 6);
    expect(writtenPitch(hzOf(69))).toBeCloseTo(69, 6);
  });
});

describe("heardPitch", () => {
  it("keeps a pitch in the trumpet's range as it is", () => {
    expect(heardPitch(hzOf(60), 60)).toBeCloseTo(60, 6);
    // Just inside the bottom of the range (F♯3), clear of floating-point error at 54.
    expect(heardPitch(hzOf(54.01), 60)).toBeCloseTo(54.01, 6);
  });

  it("takes a subharmonic back up to the multiple the note expects", () => {
    // Half the frequency locks on an octave down (48, below the range).
    expect(heardPitch(hzOf(60) / 2, 60)).toBeCloseTo(60, 6);
  });

  it("hears nothing above the highest MIDI note, which a score can't hold", () => {
    expect(heardPitch(hzOf(127), 127)).toBeCloseTo(127, 6);
    expect(heardPitch(hzOf(128), 127)).toBeNull();
  });

  it("returns null for a pitch below the range that no multiple near the note explains", () => {
    // 48's multiples are 60, 67, 72…: 61 is a semitone from 60, beyond the slack.
    expect(heardPitch(hzOf(60) / 2, 61)).toBeNull();
  });
});

describe("isVoiced", () => {
  const loud = { at: 0, hz: 440, clarity: 0.9, level: 0.1 };

  it("hears a clear, loud pitch", () => {
    expect(isVoiced(loud)).toBe(true);
  });

  it("doesn't hear silence, an unclear pitch or a quiet one", () => {
    expect(isVoiced({ ...loud, hz: 0 })).toBe(false);
    expect(isVoiced({ ...loud, clarity: 0.79 })).toBe(false);
    expect(isVoiced({ ...loud, level: 0.0029 })).toBe(false);
  });

  it("hears a clarity and a level exactly at the limits", () => {
    expect(isVoiced({ ...loud, clarity: 0.8 })).toBe(true);
    expect(isVoiced({ ...loud, level: 0.003 })).toBe(true);
  });
});
