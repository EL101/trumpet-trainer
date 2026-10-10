import { describe, expect, it } from "vitest";
import { parseMeasures, parseNote } from "./staffNotation";

describe("parseNote", () => {
  it("parses pitch, duration, dots and rests", () => {
    expect(parseNote("C#5/q", "q")).toEqual({
      key: "c#/5",
      duration: "q",
      dotted: false,
      rest: false,
    });
    expect(parseNote("G4/16.", "q")).toEqual({
      key: "g/4",
      duration: "16",
      dotted: true,
      rest: false,
    });
    expect(parseNote("B4/8/r.", "q")).toEqual({
      key: "b/4",
      duration: "8",
      dotted: true,
      rest: true,
    });
  });

  it("carries the previous duration when omitted", () => {
    expect(parseNote(" A4", "8")).toMatchObject({ key: "a/4", duration: "8" });
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
