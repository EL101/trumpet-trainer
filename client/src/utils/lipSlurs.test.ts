import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { MEASURE_LIMITS, TIME_SIGNATURES } from "@/lib/generatorOptions";
import { DIFFICULTIES, RANGES, type Difficulty, type Range } from "@/schema";
import { RANGE_NOTES } from "./generateMusic";
import {
  generateLipSlurs,
  lipSlurFingerings,
  partialDistances,
  partialsApart,
  planLipSlurs,
} from "./lipSlurs";
import { splitNotes } from "./splitNotes";

const SLUR_PARTIALS: Record<Difficulty, { min: number; max: number }> = {
  LOW: { min: 1, max: 1 },
  MED: { min: 1, max: 2 },
  HIGH: { min: 2, max: Infinity },
};

/** From open down, each a half step lower than the one before. */
const VALVE_ORDER = ["0", "2", "1", "12", "23", "13", "123"];

/** The letters each fingering's notes are spelled with: root, 5th, 3rd and 9th. */
const SPELLINGS: Record<string, string[]> = {
  "0": ["C", "G", "E", "D"],
  "2": ["B", "F#", "D#", "C#"],
  "1": ["Bb", "F", "D", "C"],
  "12": ["A", "E", "C#", "B"],
  "23": ["Ab", "Eb", "C", "Bb"],
  "13": ["G", "D", "B", "A"],
  "123": ["F#", "C#", "A#", "G#"],
};

const pitchesOf = (notes: string) =>
  notes.split(", ").map((token) => token.replace(/[()]/g, "").split("/")[0]);

type Moves = {
  /** How many partials apart the notes of each slur on one fingering are. */
  slurs: number[];
  changes: { valves: number; partials: number; semitones: number; groupStart: boolean }[];
  total: number;
};
const generated = new Map<string, Moves>();

/**
 * Every move of many 8-bar exercises, sorted into slurs on one fingering and changes.
 * Generated once for each range, difficulty and time signature, and shared between tests.
 */
function moves(range: Range, difficulty: Difficulty, timeSig = "4/4"): Moves {
  const id = `${range} ${difficulty} ${timeSig}`;
  if (!generated.has(id)) generated.set(id, generateMoves(range, difficulty, timeSig));
  return generated.get(id)!;
}

function generateMoves(range: Range, difficulty: Difficulty, timeSig: string): Moves {
  const slurs: Moves["slurs"] = [];
  const changes: Moves["changes"] = [];
  const groupSize = timeSig === "6/8" ? 3 : Number(timeSig.split("/")[0]);
  for (let run = 0; run < 100; run++) {
    const plan = planLipSlurs(8, timeSig, range, difficulty);
    plan.slice(1).forEach((note, i) => {
      const previous = plan[i];
      const partials = Math.abs(note.partial - previous.partial);
      if (note.fingering === previous.fingering) slurs.push(partials);
      else {
        changes.push({
          valves: Math.abs(
            VALVE_ORDER.indexOf(note.fingering) - VALVE_ORDER.indexOf(previous.fingering),
          ),
          partials,
          semitones: Math.abs(note.midi - previous.midi),
          groupStart: (i + 1) % groupSize === 0,
        });
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

  it("lists the distance on every fingering that plays both notes", () => {
    expect(partialDistances("G4", "C5")).toEqual([1]); // open
    expect(partialDistances("C5", "D5")).toEqual([]);
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
      const notes = generateLipSlurs(3, timeSig, "MED", "MED");
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
});

describe("planLipSlurs", () => {
  it.each(RANGES)(
    "keeps to the %s range, spelling each note from its fingering's series",
    (range) => {
      const [low, high] = RANGE_NOTES[range].map((n) => Note.midi(n)!);
      for (const difficulty of DIFFICULTIES) {
        for (let run = 0; run < 20; run++) {
          for (const note of planLipSlurs(4, "4/4", range, difficulty)) {
            expect(note.midi).toBe(Note.midi(note.pitch));
            expect(note.midi).toBeGreaterThanOrEqual(low);
            expect(note.midi).toBeLessThanOrEqual(high);
            expect(SPELLINGS[note.fingering]).toContain(Note.pitchClass(note.pitch));
          }
        }
      }
    },
  );

  it("starts on any fingering, and ends on that fingering's root", () => {
    const starts = new Set<string>();
    for (let bars = MEASURE_LIMITS.min; bars <= MEASURE_LIMITS.max; bars++) {
      for (const timeSig of TIME_SIGNATURES) {
        for (const range of RANGES) {
          for (const difficulty of DIFFICULTIES) {
            const plan = planLipSlurs(bars, timeSig, range, difficulty);
            const [first, last] = [plan[0], plan.at(-1)!];
            starts.add(first.fingering);
            expect(last.fingering).toBe(first.fingering);
            expect(Note.pitchClass(last.pitch)).toBe(SPELLINGS[first.fingering][0]);
          }
        }
      }
    }
    expect(starts.size).toBe(VALVE_ORDER.length);
  });

  it("slurs as far as the difficulty allows", () => {
    for (const range of RANGES) {
      for (const difficulty of DIFFICULTIES) {
        const { min, max } = SLUR_PARTIALS[difficulty];
        for (const apart of moves(range, difficulty).slurs) {
          expect(apart).toBeGreaterThanOrEqual(min);
          expect(apart).toBeLessThanOrEqual(max);
        }
      }
    }
  }, 30000);

  it("changes to the next valve combination, a half step at low or up to a third above", () => {
    for (const range of RANGES) {
      for (const difficulty of DIFFICULTIES) {
        for (const { valves, partials, semitones } of moves(range, difficulty).changes) {
          expect(valves).toBe(1);
          if (difficulty === "LOW") {
            expect(partials).toBe(0);
            expect(semitones).toBe(1);
          } else {
            expect(partials).toBeLessThanOrEqual(1);
            expect(semitones).toBeLessThanOrEqual(4);
          }
        }
      }
    }
  }, 30000);

  it("leans a little towards the narrower slurs at high difficulty", () => {
    const { slurs } = moves("ANY", "HIGH");
    const two = slurs.filter((apart) => apart === 2).length / slurs.length;
    const wide = slurs.filter((apart) => apart >= 6).length / slurs.length;
    expect(two).toBeGreaterThan(0.24);
    expect(two).toBeLessThan(0.38);
    // About 21% if every width weighed the same.
    expect(wide).toBeLessThan(0.19);
  }, 30000);

  it("changes fingering about a tenth of the time, mostly where a bar starts", () => {
    for (const timeSig of ["4/4", "3/4", "6/8"]) {
      for (const difficulty of DIFFICULTIES) {
        const { changes, total } = moves("MED", difficulty, timeSig);
        expect(changes.length / total).toBeGreaterThan(0.07);
        expect(changes.length / total).toBeLessThan(0.13);
        const midGroup = changes.filter((c) => !c.groupStart).length;
        expect(midGroup / total).toBeLessThan(0.05);
      }
    }
  }, 30000);

  it("moves onto another partial when changing fingering more as the difficulty rises", () => {
    const partialShare = (difficulty: Difficulty) => {
      const { changes } = moves("MED", difficulty);
      return changes.filter((c) => c.partials > 0).length / changes.length;
    };
    const [low, med, high] = DIFFICULTIES.map(partialShare);
    expect(low).toBe(0);
    expect(med).toBeGreaterThan(0.38);
    expect(med).toBeLessThan(0.62);
    expect(high).toBeGreaterThan(0.7);
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

  it("reads sharps and flats alike", () => {
    // D#5 on 2, spelled from B; the same note is Eb5 on 23.
    expect(lipSlurFingerings("B4/q, D#5/q, F#5/q")).toEqual(["2", "", ""]);
    expect(lipSlurFingerings("Ab4/q, C5/q, Eb5/q")).toEqual(["23", "", ""]);
  });

  it("leaves rests unlabelled", () => {
    expect(lipSlurFingerings("C5/q, B4/q/r, E5/h")).toEqual(["0", "", ""]);
  });

  it("gives every note of a generated exercise a fingering it can slur on", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 50; run++) {
        const notes = generateLipSlurs(4, "4/4", "MED", difficulty);
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
