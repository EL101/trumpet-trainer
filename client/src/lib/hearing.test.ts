import { describe, expect, it } from "vitest";
import { dipAt, firstFrom, heardPitch, isVoiced, writtenPitch } from "./hearing";
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

describe("firstFrom", () => {
  it("finds the first sample at or after a place, or the end if there's none", () => {
    const samples = [0, 0.5, 0.5, 1].map((at) => ({ at, hz: 0, clarity: 0, level: 0 }));
    expect(firstFrom(samples, 0.5)).toBe(1);
    expect(firstFrom(samples, 0.6)).toBe(3);
    expect(firstFrom(samples, -1)).toBe(0);
    expect(firstFrom(samples, 2)).toBe(4);
  });
});

describe("dipAt", () => {
  // Frames 1/60 s apart at ♩ = 120 (half a second a quarter), with these levels.
  const SPQ = 0.5;
  const frames = (...levels: number[]) =>
    levels.map((level, f) => ({ at: f / 30, hz: 440, clarity: 0.95, level }));

  it("finds the bottom of a tongue stop's dip in level", () => {
    const samples = frames(1, 1, 1, 0.81, 0.52, 0.58, 0.86, 1, 1);
    expect(samples.map((_, i) => dipAt(samples, i, SPQ))).toEqual([
      ...[false, false, false, false, true],
      ...[false, false, false, false],
    ]);
  });

  it("takes the last frame of a flat bottom", () => {
    const samples = frames(1, 1, 0.8, 0.5, 0.5, 0.8, 1, 1);
    expect(samples.map((_, i) => dipAt(samples, i, SPQ)).indexOf(true)).toBe(4);
    expect(samples.filter((_, i) => dipAt(samples, i, SPQ))).toHaveLength(1);
  });

  it("doesn't find a shallow dip, a fade, or one with nothing heard after it", () => {
    const shallow = frames(1, 1, 0.9, 0.8, 0.9, 1, 1);
    expect(shallow.some((_, i) => dipAt(shallow, i, SPQ))).toBe(false);
    const fade = frames(1, 0.8, 0.6, 0.4, 0.2, 0.1);
    expect(fade.some((_, i) => dipAt(fade, i, SPQ))).toBe(false);
    const last = frames(1, 1, 0.5);
    expect(dipAt(last, 2, SPQ)).toBe(false);
  });

  it("looks only so far either side: a slow swell isn't a tongue stop", () => {
    // Down to half and back over a third of a second.
    const down = Array.from({ length: 10 }, (_, f) => 1 - f * 0.05);
    const swell = frames(...down, 0.5, ...down.toReversed());
    expect(swell.some((_, i) => dipAt(swell, i, SPQ))).toBe(false);
  });
});
