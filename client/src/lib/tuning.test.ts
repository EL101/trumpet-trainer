import { describe, expect, it } from "vitest";
import { nearestNote } from "./tuning";

describe("nearestNote", () => {
  it("finds the note and its offset in cents", () => {
    expect(nearestNote(440)).toEqual({ midi: 69, cents: 0 });
    expect(nearestNote(442.3)).toEqual({ midi: 69, cents: 9 });
    expect(nearestNote(261.63)).toEqual({ midi: 60, cents: 0 });
  });

  it("rounds to whichever note is closer", () => {
    // 60 cents above A4 is nearer B♭4, 40 cents below it.
    expect(nearestNote(440 * 2 ** (60 / 1200))).toEqual({ midi: 70, cents: -40 });
  });

  it("returns null when nothing is heard", () => {
    expect(nearestNote(0)).toBeNull();
    expect(nearestNote(NaN)).toBeNull();
  });
});
