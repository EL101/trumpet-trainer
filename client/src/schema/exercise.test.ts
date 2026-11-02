import { describe, expect, it } from "vitest";
import prismaSchema from "../../../server/prisma/schema.prisma?raw";
import { EXERCISE_TYPES, isMusicInfo, type MusicInfo } from "./exercise";

describe("EXERCISE_TYPES", () => {
  // The server rejects any type outside its enum, so a drift here would turn
  // every history and library save of the missing type into a 400.
  it("matches the server's ExerciseType enum", () => {
    const body = prismaSchema.match(/enum ExerciseType \{([^}]*)\}/)?.[1] ?? "";
    const values = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[A-Z_]+$/.test(line));

    expect(values).toEqual([...EXERCISE_TYPES]);
  });
});

describe("isMusicInfo", () => {
  const exercise: MusicInfo = {
    id: "a",
    exerciseId: "b",
    exerciseType: "SCALES",
    notes: "C4/q, D4, E4, F4",
    timeSig: "4/4",
    musicKey: "C major",
    noteRange: "MED",
    difficulty: "LOW",
    generationNum: 0,
  };

  it("accepts a whole exercise, numbered or not", () => {
    expect(isMusicInfo(exercise)).toBe(true);
    expect(isMusicInfo({ ...exercise, generationNum: 12 })).toBe(true);
  });

  it("turns down anything that isn't an object", () => {
    for (const value of [null, undefined, "exercise", 3, true]) {
      expect(isMusicInfo(value)).toBe(false);
    }
  });

  it("turns down an exercise missing a field, or with one of the wrong type", () => {
    for (const field of Object.keys(exercise)) {
      const { [field]: _, ...missing } = exercise as Record<string, unknown>;
      expect(isMusicInfo(missing), `without ${field}`).toBe(false);
      expect(isMusicInfo({ ...exercise, [field]: [] }), `${field} as an array`).toBe(false);
    }
  });

  it("turns down a type the app doesn't know", () => {
    expect(isMusicInfo({ ...exercise, exerciseType: "ARPEGGIOS" })).toBe(false);
  });
});
