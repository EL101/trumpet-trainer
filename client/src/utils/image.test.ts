import { describe, expect, it } from "vitest";
import { squareCrop } from "./image";

describe("squareCrop", () => {
  it("takes the full frame when already square", () => {
    expect(squareCrop(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 });
  });

  it("crops the sides of a landscape image", () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
  });

  it("crops the top and bottom of a portrait image", () => {
    expect(squareCrop(200, 500)).toEqual({ sx: 0, sy: 150, side: 200 });
  });

  it("stays within bounds when the excess is odd", () => {
    const { sx, side } = squareCrop(101, 100);
    expect(sx).toBe(0);
    expect(sx + side).toBeLessThanOrEqual(101);
  });

  it("handles a single-pixel image", () => {
    expect(squareCrop(1, 1)).toEqual({ sx: 0, sy: 0, side: 1 });
  });
});
