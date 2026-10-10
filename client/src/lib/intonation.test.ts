import { describe, expect, it } from "vitest";
import { centsColor, formatCents, scoreBand } from "./intonation";

describe("centsColor", () => {
  it("is green when in tune and red at or past 35¢, either direction", () => {
    expect(centsColor(0)).toBe("rgb(62, 122, 94)");
    expect(centsColor(35)).toBe("rgb(168, 74, 51)");
    expect(centsColor(-80)).toBe("rgb(168, 74, 51)");
  });

  it("hits ochre at 15¢ and interpolates between stops", () => {
    expect(centsColor(-15)).toBe("rgb(160, 111, 36)");
    // Matches the mockup's "+9¢" readout colour.
    expect(centsColor(9)).toBe("rgb(121, 115, 59)");
  });
});

describe("formatCents", () => {
  it("signs values with a true minus", () => {
    expect(formatCents(9)).toBe("+9¢");
    expect(formatCents(-4.4)).toBe("−4¢");
    expect(formatCents(0, false)).toBe("0");
  });
});

describe("scoreBand", () => {
  it("bands scores like the mockups", () => {
    expect(scoreBand(93)).toBe("good");
    expect(scoreBand(81)).toBe("fair");
    expect(scoreBand(40)).toBe("bad");
  });
});
