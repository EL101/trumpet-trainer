import { describe, expect, it } from "vitest";
import { getKeySig, PRACTICAL_MAJOR, PRACTICAL_MINOR } from "@/utils/generateMusic";
import { isCommonKey, KEY_ROWS, keyChoices } from "./generatorOptions";

describe("KEY_ROWS", () => {
  it("offers every key the generator plays in, once each", () => {
    const keys = KEY_ROWS.flat();
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(
      [
        ...PRACTICAL_MAJOR.map((k) => `${k} major`),
        ...PRACTICAL_MINOR.map((k) => `${k} minor`),
      ].sort(),
    );
  });

  it("pairs each major key with its relative minor", () => {
    for (const [major, minor] of KEY_ROWS) {
      expect(getKeySig(minor)).toBe(major.split(" ")[0]);
    }
  });
});

describe("keyChoices", () => {
  it("lists the five common rows first, then the rest", () => {
    expect(keyChoices(false)).toEqual([
      "C major",
      "A minor",
      "G major",
      "E minor",
      "F major",
      "D minor",
      "Bb major",
      "G minor",
      "D major",
      "B minor",
    ]);
    expect(keyChoices(true)).toHaveLength(28);
  });

  it("knows which keys sit behind 'More keys'", () => {
    expect(isCommonKey("Bb major")).toBe(true);
    expect(isCommonKey("F# minor")).toBe(false);
  });
});
