import { describe, expect, it } from "vitest";
import prismaSchema from "../../../server/prisma/schema.prisma?raw";
import { EXERCISE_TYPES } from "./exercise";

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
