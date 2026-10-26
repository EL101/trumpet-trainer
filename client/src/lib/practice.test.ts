import { describe, expect, it } from "vitest";
import type { MusicInfo } from "@/schema";
import { backTo, originFor, readPracticed, readPracticeState } from "./practice";

const exercise: MusicInfo = {
  id: "a",
  exerciseId: "b",
  exerciseType: "SCALES",
  notes: "C4/q, D4, E4, F4",
  timeSig: "4/4",
  musicKey: "C major",
  noteRange: "MED",
  difficulty: "LOW",
  generationNum: 3,
};

const NAV = [
  { to: "/today", label: "Today" },
  { to: "/generate", label: "Generate" },
];

describe("originFor", () => {
  it("names the page as the nav does", () => {
    expect(originFor("/generate", NAV)).toEqual({ to: "/generate", label: "Generate" });
  });

  it("falls back to a plain Back for a page the nav doesn't list", () => {
    expect(originFor("/somewhere", NAV)).toEqual({ to: "/somewhere", label: "Back" });
  });
});

describe("backTo", () => {
  it("names the page it goes back to", () => {
    expect(backTo({ to: "/today", label: "Today" })).toBe("Back to Today");
    expect(backTo({ to: "/somewhere", label: "Back" })).toBe("Back");
  });
});

describe("readPracticeState", () => {
  it("reads the exercise and where it came from", () => {
    const from = { to: "/generate", label: "Generate" };
    expect(readPracticeState({ exercise, from })).toEqual({ exercise, from });
  });

  it("returns null when there's nothing to play", () => {
    expect(readPracticeState(null)).toBeNull();
    expect(readPracticeState({ from: { to: "/generate", label: "Generate" } })).toBeNull();
    expect(readPracticeState({ exercise: { id: "a" }, from: { to: "/", label: "x" } })).toBeNull();
    expect(readPracticeState({ exercise })).toBeNull();
  });
});

describe("readPracticed", () => {
  it("reads the exercise handed back", () => {
    expect(readPracticed({ practiced: exercise })).toBe(exercise);
  });

  it("returns null otherwise", () => {
    expect(readPracticed(undefined)).toBeNull();
    expect(readPracticed({ practiced: "a" })).toBeNull();
  });
});
