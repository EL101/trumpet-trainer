import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { TIME_SIGNATURES } from "@/lib/generatorOptions";
import { DIFFICULTIES, RANGES, type Difficulty, type Key } from "@/schema";
import { RANGE_NOTES, scaleNotesInRange } from "./generateMusic";
import { generateLipSlurs, lipSlurFingerings, partialsApart } from "./lipSlurs";
import { splitNotes } from "./splitNotes";

const PARTIAL_LEAP: Record<Difficulty, number> = { LOW: 1, MED: 2, HIGH: Infinity };

const pitchesOf = (notes: string) =>
  notes.split(", ").map((token) => token.replace(/[()]/g, "").split("/")[0]);

type Moves = {
  slurs: number[];
  changes: { steps: number; groupStart: boolean }[];
  total: number;
};
const generated = new Map<string, Moves>();

/**
 * Every move of many 8-bar exercises, sorted into slurs on one fingering and changes.
 * Generated once for each key, difficulty and time signature, and shared between tests.
 */
function moves(key: Key, difficulty: Difficulty, timeSig = "4/4"): Moves {
  const id = `${key} ${difficulty} ${timeSig}`;
  if (!generated.has(id)) generated.set(id, generateMoves(key, difficulty, timeSig));
  return generated.get(id)!;
}

function generateMoves(key: Key, difficulty: Difficulty, timeSig: string): Moves {
  const scale = scaleNotesInRange(key, "MED");
  const slurs: Moves["slurs"] = [];
  const changes: Moves["changes"] = [];
  const perBar = timeSig === "6/8" ? 6 : Number(timeSig.split("/")[0]);
  const groupSize = timeSig === "6/8" ? 3 : perBar;
  for (let run = 0; run < 100; run++) {
    const pitches = pitchesOf(generateLipSlurs(8, timeSig, key, "MED", difficulty));
    pitches.slice(1).forEach((pitch, i) => {
      const apart = partialsApart(pitches[i], pitch);
      if (apart !== null) slurs.push(apart);
      else {
        const steps = Math.abs(scale.indexOf(pitch) - scale.indexOf(pitches[i]));
        changes.push({ steps, groupStart: (i + 1) % groupSize === 0 });
      }
    });
  }
  return { slurs, changes, total: slurs.length + changes.length };
}

describe("partialsApart", () => {
  it("counts partials on the fingering both notes share", () => {
    expect(partialsApart("G4", "C5")).toBe(1); // open
    expect(partialsApart("G4", "E5")).toBe(2); // open, over C5
    expect(partialsApart("C4", "C6")).toBe(5); // open, skipping the out-of-tune 7th
    expect(partialsApart("B4", "D5")).toBe(1); // 1 and 3
  });

  it("is null when no one fingering plays both notes", () => {
    expect(partialsApart("C5", "D5")).toBeNull();
    expect(partialsApart("E5", "F5")).toBeNull();
  });
});

describe("generateLipSlurs", () => {
  it.each(TIME_SIGNATURES)(
    "fills the bars with one slur each, in quarters (or eighths in x/8), in %s",
    (timeSig) => {
      const notes = generateLipSlurs(3, timeSig, "C major", "MED", "MED");
      const bars = splitNotes(notes, timeSig);
      expect(bars).toHaveLength(3);
      const value = timeSig.endsWith("/8") ? "8" : "q";
      for (const bar of bars) {
        const tokens = bar.split(", ");
        expect(tokens.map((t) => t.startsWith("("))).toEqual(tokens.map((_, i) => i === 0));
        expect(tokens.map((t) => t.endsWith(")"))).toEqual(
          tokens.map((_, i) => i === tokens.length - 1),
        );
        for (const token of tokens) expect(token.replace(/[()]/g, "").split("/")[1]).toBe(value);
      }
    },
  );

  it.each(RANGES)("keeps to the key and %s range, and ends on the tonic", (range) => {
    const [low, high] = RANGE_NOTES[range].map((n) => Note.midi(n)!);
    for (const key of ["C major", "Eb major", "A minor", "F# major"] as const) {
      const scale = scaleNotesInRange(key, range);
      for (const difficulty of DIFFICULTIES) {
        for (let run = 0; run < 20; run++) {
          const pitches = pitchesOf(generateLipSlurs(4, "4/4", key, range, difficulty));
          for (const pitch of pitches) {
            expect(scale).toContain(pitch);
            expect(Note.midi(pitch)).toBeGreaterThanOrEqual(low);
            expect(Note.midi(pitch)).toBeLessThanOrEqual(high);
          }
          expect(Note.pitchClass(pitches.at(-1)!)).toBe(key.split(" ")[0]);
        }
      }
    }
  });

  it("slurs as far as the difficulty allows, or changes fingering by a step or a third", () => {
    for (const key of ["C major", "Eb major", "A minor"] as const) {
      for (const difficulty of DIFFICULTIES) {
        const { slurs, changes } = moves(key, difficulty);
        for (const apart of slurs) {
          expect(apart).toBeGreaterThan(0);
          expect(apart).toBeLessThanOrEqual(PARTIAL_LEAP[difficulty]);
        }
        for (const { steps } of changes) expect([1, 2]).toContain(steps);
      }
    }
  }, 30000);

  it("changes fingering about a tenth of the time, mostly where a bar starts", () => {
    for (const timeSig of ["4/4", "3/4", "6/8"]) {
      for (const difficulty of DIFFICULTIES) {
        const { changes, total } = moves("C major", difficulty, timeSig);
        expect(changes.length / total).toBeGreaterThan(0.06);
        expect(changes.length / total).toBeLessThan(0.14);
        const midGroup = changes.filter((c) => !c.groupStart).length;
        expect(midGroup / total).toBeLessThan(0.1);
      }
    }
  }, 30000);

  it("changes fingering by thirds more as the difficulty rises", () => {
    // Pooled over a few keys: how many thirds are on offer varies from key to key.
    const thirdShare = (difficulty: Difficulty) => {
      const changes = (["C major", "Eb major", "A minor"] as const).flatMap(
        (key) => moves(key, difficulty).changes,
      );
      return changes.filter((c) => c.steps === 2).length / changes.length;
    };
    const [low, med, high] = DIFFICULTIES.map(thirdShare);
    expect(low).toBeLessThan(0.4);
    expect(med).toBeGreaterThan(0.38);
    expect(med).toBeLessThan(0.62);
    expect(high).toBeGreaterThan(0.55);
    expect(low).toBeLessThan(med);
    expect(med).toBeLessThan(high);
  }, 30000);
});

describe("lipSlurFingerings", () => {
  it("labels where the fingering changes, and keeps it through a run on one fingering", () => {
    // G4 C5 E5 C5 all on open; D5 F5 D5 on 1.
    expect(lipSlurFingerings("G4/q, C5/q, E5/q, C5/q, D5/q, F5/q, D5/q")).toEqual([
      ...["0", "", "", ""],
      ...["1", "", ""],
    ]);
  });

  it("labels the start of every slur, even on the same fingering", () => {
    expect(lipSlurFingerings("(C4/q, G4/q), (C5/q, G4/q)")).toEqual(["0", "", "0", ""]);
  });

  it("picks the fingering that carries furthest, or the usual one", () => {
    // B4 is 2 on its own, but 13 when the run goes on to D5 and G5 on 13.
    expect(lipSlurFingerings("B4/q")).toEqual(["2"]);
    expect(lipSlurFingerings("B4/q, D5/q, G5/q")).toEqual(["13", "", ""]);
  });

  it("leaves rests unlabelled", () => {
    expect(lipSlurFingerings("C5/q, B4/q/r, E5/h")).toEqual(["0", "", ""]);
  });

  it("gives every note of a generated exercise a fingering it can slur on", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        const notes = generateLipSlurs(4, "4/4", "Eb major", "MED", difficulty);
        const pitches = pitchesOf(notes);
        const labels = lipSlurFingerings(notes);
        expect(labels).toHaveLength(pitches.length);
        expect(labels[0]).not.toBe("");
        // Between labels the fingering holds, so those notes slur on one fingering.
        pitches.slice(1).forEach((pitch, i) => {
          if (labels[i + 1] === "") expect(partialsApart(pitches[i], pitch)).not.toBeNull();
        });
      }
    }
  });
});
