import { describe, expect, it } from "vitest";
import { barQuarters, beatAt, HALF_NOTE, pulseOf } from "./meter";

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
