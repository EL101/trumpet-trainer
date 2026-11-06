import { describe, expect, it } from "vitest";
import {
  barQuarters,
  beatAt,
  clampTempo,
  DEFAULT_TEMPO,
  HALF_NOTE,
  MAX_TEMPO,
  MIN_TEMPO,
  pulseOf,
  subdivisionFor,
} from "./meter";

describe("pulseOf", () => {
  it("counts simple quarter-note meters in quarters", () => {
    for (const [sig, beats] of [
      ["4/4", 4],
      ["3/4", 3],
      ["2/4", 2],
    ] as const) {
      const pulse = pulseOf(sig);
      expect(pulse).toMatchObject({ beats, quarters: 1, symbol: "♩" });
      expect(barQuarters(pulse)).toBe(beats);
    }
  });

  it("counts cut time in halves", () => {
    const pulse = pulseOf("2/2");
    expect(pulse).toMatchObject({ beats: 2, quarters: 2, symbol: HALF_NOTE });
    expect(barQuarters(pulse)).toBe(4);
  });

  it("counts compound meters in dotted quarters", () => {
    expect(pulseOf("6/8")).toMatchObject({ beats: 2, quarters: 1.5, symbol: "♩." });
    expect(pulseOf("9/8")).toMatchObject({ beats: 3, quarters: 1.5 });
    expect(barQuarters(pulseOf("12/8"))).toBe(6);
  });

  it("counts 3/8 in eighths", () => {
    const pulse = pulseOf("3/8");
    expect(pulse).toMatchObject({ beats: 3, quarters: 0.5, symbol: "♪" });
    expect(barQuarters(pulse)).toBe(1.5);
  });

  it("offers subdivisions that divide the beat, the plain beat first", () => {
    expect(pulseOf("4/4").subdivisions.map((s) => s.per)).toEqual([1, 2, 4]);
    expect(pulseOf("6/8").subdivisions.map((s) => s.per)).toEqual([1, 3]);
  });
});

describe("beatAt", () => {
  it("counts beats within the bar", () => {
    const pulse = pulseOf("3/4");
    expect([0, 1, 2.5, 3, 5.9].map((p) => beatAt(pulse, p))).toEqual([0, 1, 2, 0, 2]);
  });

  it("counts a count-in before the top as a bar of its own", () => {
    const pulse = pulseOf("4/4");
    expect([-4, -3, -0.5].map((p) => beatAt(pulse, p))).toEqual([0, 1, 3]);
  });

  it("counts compound meters in dotted quarters", () => {
    const pulse = pulseOf("6/8");
    expect([0, 1.4, 1.5, 2.9].map((p) => beatAt(pulse, p))).toEqual([0, 0, 1, 1]);
  });
});

describe("clampTempo", () => {
  it("keeps a tempo within the limits", () => {
    expect(clampTempo(96)).toBe(96);
    expect(clampTempo(10)).toBe(MIN_TEMPO);
    expect(clampTempo(400)).toBe(MAX_TEMPO);
  });

  it("falls back to the default for a stored value that isn't a number", () => {
    expect([undefined, null, "fast", NaN].map(clampTempo)).toEqual(Array(4).fill(DEFAULT_TEMPO));
  });
});

describe("subdivisionFor", () => {
  it("gives the clicks per beat the pulse offers", () => {
    expect(subdivisionFor(pulseOf("4/4"), 4)).toBe(4);
    expect(subdivisionFor(pulseOf("6/8"), 3)).toBe(3);
  });

  it("falls back to the plain beat for one it doesn't", () => {
    expect(subdivisionFor(pulseOf("6/8"), 4)).toBe(1);
    expect(subdivisionFor(pulseOf("4/4"), 3)).toBe(1);
  });
});
