import { describe, expect, it } from "vitest";
import type { LibraryEntry } from "@/schema";
import {
  appendUnique,
  cardLabel,
  chunkDelay,
  countLabel,
  formatSavedDate,
  incipit,
  isLibraryFilter,
  placeholderCount,
  rowEnd,
} from "./library";

describe("isLibraryFilter", () => {
  it("accepts All and every exercise type", () => {
    expect(isLibraryFilter("ALL")).toBe(true);
    expect(isLibraryFilter("LIP_SLURS")).toBe(true);
  });

  it("turns down anything else", () => {
    for (const value of ["SAVED", "", null, 3]) expect(isLibraryFilter(value)).toBe(false);
  });
});

describe("appendUnique", () => {
  const a = { exerciseId: "a" };
  const b = { exerciseId: "b" };
  const c = { exerciseId: "c" };

  it("adds the next chunk after what's there", () => {
    expect(appendUnique([a], [b, c])).toEqual([a, b, c]);
  });

  it("leaves out entries already there", () => {
    expect(appendUnique([a, b], [b, c])).toEqual([a, b, c]);
  });
});

describe("placeholderCount", () => {
  it("holds the rest of the library, up to a page", () => {
    expect(placeholderCount(24, 30)).toBe(6);
    expect(placeholderCount(24, 300)).toBe(24);
  });

  it("keeps one when the total is out of date", () => {
    expect(placeholderCount(24, 24)).toBe(1);
    expect(placeholderCount(24, 20)).toBe(1);
  });
});

describe("chunkDelay", () => {
  it("staggers a chunk from its first card", () => {
    expect(chunkDelay(24, 24)).toBe(0);
    expect(chunkDelay(26, 24)).toBe(60);
  });

  it("doesn't hold back cards already there, or grow past a dozen", () => {
    expect(chunkDelay(3, 24)).toBe(0);
    expect(chunkDelay(47, 24)).toBe(360);
  });
});

describe("countLabel", () => {
  it("says exercise for one and exercises otherwise", () => {
    expect(countLabel(0)).toBe("0 exercises");
    expect(countLabel(1)).toBe("1 exercise");
    expect(countLabel(24)).toBe("24 exercises");
  });
});

describe("rowEnd", () => {
  it("finds the last card of the row in a full grid", () => {
    expect(rowEnd(0, 3, 9)).toBe(2);
    expect(rowEnd(2, 3, 9)).toBe(2);
    expect(rowEnd(4, 3, 9)).toBe(5);
  });

  it("stops at the last card in a short final row", () => {
    expect(rowEnd(6, 3, 7)).toBe(6);
    expect(rowEnd(3, 2, 4)).toBe(3);
  });

  it("puts each card in its own row in one column, or before columns are known", () => {
    expect(rowEnd(3, 1, 9)).toBe(3);
    expect(rowEnd(3, 0, 9)).toBe(3);
  });
});

describe("incipit", () => {
  it("takes the first bar", () => {
    expect(incipit("C4/q, D4, E4, F4, G4/h, A4/h", "4/4")).toBe("C4/q, D4, E4, F4");
  });

  it("takes as many bars as asked, or all there are", () => {
    expect(incipit("C4/h, D4/h, E4/w", "4/4", 2)).toBe("C4/h, D4/h, E4/w");
    expect(incipit("C4/w", "4/4", 3)).toBe("C4/w");
  });
});

describe("formatSavedDate", () => {
  const now = new Date("2026-11-03T12:00:00Z");

  it("leaves the year out this year", () => {
    expect(formatSavedDate("2026-03-14T12:00:00Z", now)).toBe("14 Mar");
  });

  it("gives the year for another year", () => {
    expect(formatSavedDate("2025-11-03T12:00:00Z", now)).toBe("3 Nov 2025");
  });

  it("gives nothing for a date it can't read", () => {
    expect(formatSavedDate("not a date", now)).toBe("");
  });
});

describe("cardLabel", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const entry: LibraryEntry = {
    id: "a",
    exerciseId: "a",
    exerciseType: "SCALES",
    notes: "C4/q, D4, E4, F4, G4/w",
    timeSig: "4/4",
    musicKey: "Bb minor",
    noteRange: "MED",
    difficulty: "LOW",
    generationNum: 42,
    createdAt: "2026-11-03T12:00:00Z",
  };

  it("gives the card's number, key, time, length and date", () => {
    expect(cardLabel(entry, now)).toBe("Scales No. 42, B♭ minor, 4/4, 2 bars, saved 3 Nov");
  });

  it("leaves out the key of a lip slur, and a date it can't read", () => {
    expect(
      cardLabel({ ...entry, exerciseType: "LIP_SLURS", notes: "C4/w", createdAt: "?" }, now),
    ).toBe("Lip slurs No. 42, 4/4, 1 bar");
  });
});
