import { describe, expect, it } from "vitest";
import type { MusicInfo } from "@/schema";
import {
  countLabel,
  filterLibrary,
  formatSavedDate,
  incipit,
  isLibraryFilter,
  rowEnd,
} from "./library";

function exercise(overrides: Partial<MusicInfo>): MusicInfo {
  return {
    id: "a",
    exerciseId: "a",
    exerciseType: "SCALES",
    notes: "C4/q, D4, E4, F4",
    timeSig: "4/4",
    musicKey: "C major",
    noteRange: "MED",
    difficulty: "LOW",
    generationNum: 1,
    ...overrides,
  };
}

const bbMinorScale = exercise({ id: "1", musicKey: "Bb minor", generationNum: 42 });
const gLongTones = exercise({
  id: "2",
  exerciseType: "LONG_TONES",
  musicKey: "G major",
  timeSig: "3/4",
  generationNum: 7,
});
const lipSlurs = exercise({ id: "3", exerciseType: "LIP_SLURS", generationNum: 12 });
const all = [bbMinorScale, gLongTones, lipSlurs];

describe("isLibraryFilter", () => {
  it("accepts All and every exercise type", () => {
    expect(isLibraryFilter("ALL")).toBe(true);
    expect(isLibraryFilter("LIP_SLURS")).toBe(true);
  });

  it("turns down anything else", () => {
    for (const value of ["SAVED", "", null, 3]) expect(isLibraryFilter(value)).toBe(false);
  });
});

describe("filterLibrary", () => {
  it("keeps everything for All with no search", () => {
    expect(filterLibrary(all, "ALL", "")).toEqual(all);
    expect(filterLibrary(all, "ALL", "   ")).toEqual(all);
  });

  it("keeps only the chosen type", () => {
    expect(filterLibrary(all, "LONG_TONES", "")).toEqual([gLongTones]);
    expect(filterLibrary(all, "ETUDES", "")).toEqual([]);
  });

  it("finds a key written with ASCII or music accidentals, in any word order", () => {
    expect(filterLibrary(all, "ALL", "bb minor")).toEqual([bbMinorScale]);
    expect(filterLibrary(all, "ALL", "minor B♭")).toEqual([bbMinorScale]);
  });

  it("finds an exercise by its type, number or time signature", () => {
    expect(filterLibrary(all, "ALL", "long")).toEqual([gLongTones]);
    expect(filterLibrary(all, "ALL", "no. 42")).toEqual([bbMinorScale]);
    expect(filterLibrary(all, "ALL", "3/4")).toEqual([gLongTones]);
  });

  it("doesn't find lip slurs by the C major they're stored in", () => {
    expect(filterLibrary(all, "ALL", "c major")).toEqual([]);
  });

  it("needs every word to match, within the chosen type", () => {
    expect(filterLibrary(all, "ALL", "scales g")).toEqual([]);
    expect(filterLibrary(all, "SCALES", "long")).toEqual([]);
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
