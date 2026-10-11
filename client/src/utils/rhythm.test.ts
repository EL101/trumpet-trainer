import { describe, expect, it } from "vitest";
import { TIME_SIGNATURES } from "@/lib/generatorOptions";
import { DIFFICULTIES, type Difficulty } from "@/schema";
import { barLength } from "./notate";
import { figureLength, randomFigure, rhythmFor, type Figure } from "./rhythm";

/** Four bars of figures, each with the position it starts at. */
function fourBars(timeSig: string, difficulty: Difficulty) {
  const rhythm = rhythmFor(timeSig, difficulty);
  const total = 4 * barLength(timeSig);
  const placed: { figure: Figure; position: number }[] = [];
  for (let position = 0; position < total; ) {
    const figure = randomFigure(rhythm, position, { left: total - position });
    placed.push({ figure, position });
    position += figureLength(figure);
  }
  return { rhythm, total, placed };
}

describe("rhythmFor", () => {
  it("counts simple meters in quarters, and compound meters in dotted quarters", () => {
    expect(rhythmFor("4/4", "LOW").beat).toBe(1);
    expect(rhythmFor("2/2", "LOW").beat).toBe(1);
    expect(rhythmFor("6/8", "LOW").beat).toBe(1.5);
    expect(rhythmFor("3/8", "LOW").beat).toBe(1.5);
  });

  it("builds each difficulty on the one below it", () => {
    for (const timeSig of ["4/4", "6/8"]) {
      const [low, med, high] = DIFFICULTIES.map((d) => rhythmFor(timeSig, d).figures);
      expect(med).toEqual(expect.arrayContaining(low));
      expect(high).toEqual(expect.arrayContaining(med));
    }
  });
});

describe("randomFigure", () => {
  it.each(TIME_SIGNATURES)("fills the bars exactly in %s", (timeSig) => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        const { total, placed } = fourBars(timeSig, difficulty);
        const end = placed.at(-1)!;
        expect(end.position + figureLength(end.figure)).toBe(total);
      }
    }
  });

  it.each(TIME_SIGNATURES)(
    "finishes the beat with any figure started off it, below high difficulty, in %s",
    (timeSig) => {
      for (const difficulty of ["LOW", "MED"] as const) {
        for (let run = 0; run < 50; run++) {
          const { rhythm, placed } = fourBars(timeSig, difficulty);
          for (const { figure, position } of placed) {
            const offset = position % rhythm.beat;
            if (offset) expect(offset + figureLength(figure)).toBeLessThanOrEqual(rhythm.beat);
          }
        }
      }
    },
  );

  it("syncopates across the beat at high difficulty", () => {
    const crossesBeat = () => {
      const { rhythm, placed } = fourBars("4/4", "HIGH");
      return placed.some(({ figure, position }) => {
        const offset = position % rhythm.beat;
        return offset > 0 && offset + figureLength(figure) > rhythm.beat;
      });
    };
    expect(Array.from({ length: 20 }, crossesBeat).some(Boolean)).toBe(true);
  });

  it("keeps to the number of notes asked for", () => {
    const rhythm = rhythmFor("4/4", "MED");
    for (let run = 0; run < 50; run++) {
      expect(randomFigure(rhythm, 0, { maxNotes: 1 })).toHaveLength(1);
      expect(randomFigure(rhythm, 0.5, { maxNotes: 1 })).toEqual([0.5]);
    }
  });
});
