import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "@/schema";
import { closingTonic, nextPitch, withinLeap } from "./melody";

/** C major from C4 to C6, the Medium range. */
const C_MAJOR = ["C", "D", "E", "F", "G", "A", "B"].flatMap((n) => [`${n}4`, `${n}5`]).concat("C6");
C_MAJOR.sort((a, b) => Note.midi(a)! - Note.midi(b)!);

/** Many 40-note melodies, as the scale steps between each note and the next. */
function intervals(difficulty: Difficulty) {
  const steps: number[] = [];
  const melodies: string[][] = [];
  for (let run = 0; run < 200; run++) {
    const played: string[] = [];
    for (let k = 0; k < 40; k++) played.push(nextPitch(C_MAJOR, played, difficulty));
    played.slice(1).forEach((pitch, i) => {
      steps.push(C_MAJOR.indexOf(pitch) - C_MAJOR.indexOf(played[i]));
    });
    melodies.push(played);
  }
  return { steps, melodies };
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

describe("withinLeap", () => {
  it("allows up to a fifth at low difficulty, but not the tritone", () => {
    expect(withinLeap(7, "LOW")).toBe(true);
    expect(withinLeap(-7, "LOW")).toBe(true);
    expect(withinLeap(8, "LOW")).toBe(false);
    expect(withinLeap(6, "LOW")).toBe(false);
  });

  it("allows up to an octave at medium, and an octave and a fifth at high", () => {
    expect(withinLeap(6, "MED")).toBe(true);
    expect(withinLeap(12, "MED")).toBe(true);
    expect(withinLeap(13, "MED")).toBe(false);
    expect(withinLeap(19, "HIGH")).toBe(true);
    expect(withinLeap(20, "HIGH")).toBe(false);
  });
});

describe("nextPitch", () => {
  it("steps back the other way after a leap of a fourth or more", () => {
    for (let run = 0; run < 50; run++) {
      expect(nextPitch(C_MAJOR, ["C4", "G4"], "LOW")).toBe("F4");
      expect(nextPitch(C_MAJOR, ["C5", "F4"], "MED")).toBe("G4");
    }
  });

  it("carries on as usual when the step back is out of range", () => {
    for (let run = 0; run < 50; run++) {
      const next = nextPitch(C_MAJOR, ["G4", "C4"], "LOW");
      expect(withinLeap(Note.midi(next)! - Note.midi("C4")!, "LOW")).toBe(true);
    }
  });

  it("keeps to the difficulty's leap", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 200; run++) {
        const next = nextPitch(C_MAJOR, ["F4"], difficulty);
        expect(withinLeap(Note.midi(next)! - Note.midi("F4")!, difficulty)).toBe(true);
      }
    }
  });

  it("moves by step more than by any other interval", () => {
    for (const difficulty of DIFFICULTIES) {
      const sizes = intervals(difficulty).steps.map(Math.abs);
      const share = (size: number) => sizes.filter((s) => s === size).length / sizes.length;
      for (let size = 0; size <= 7; size++) {
        if (size !== 1) expect(share(1)).toBeGreaterThan(share(size));
      }
    }
  });

  it("moves by step about 35% of the time at high difficulty", () => {
    const sizes = intervals("HIGH").steps.map(Math.abs);
    const steps = sizes.filter((size) => size === 1).length / sizes.length;
    expect(steps).toBeGreaterThan(0.3);
    expect(steps).toBeLessThan(0.4);
  });

  it("leaps wider as the difficulty rises", () => {
    const [low, med, high] = DIFFICULTIES.map((d) => mean(intervals(d).steps.map(Math.abs)));
    expect(low).toBeLessThan(med);
    expect(med).toBeLessThan(high);
  });

  it("only sometimes steps back after a leap of a sixth or more at high difficulty", () => {
    let leaps = 0;
    let recovered = 0;
    intervals("HIGH").steps.forEach((step, i, steps) => {
      if (Math.abs(step) < 5 || i + 1 >= steps.length || i % 39 === 38) return;
      leaps++;
      if (steps[i + 1] === -Math.sign(step)) recovered++;
    });
    expect(recovered / leaps).toBeGreaterThan(0.5);
    expect(recovered / leaps).toBeLessThan(0.85);
  });

  it("spends more time in the middle of the range than at the edges", () => {
    const notes = intervals("HIGH").melodies.flat();
    // C4 to C6: the middle half runs from F#4 to F#5.
    const inMiddle = notes.filter((p) => Math.abs(Note.midi(p)! - 72) <= 6).length;
    expect(inMiddle / notes.length).toBeGreaterThan(0.55);
  });
});

describe("closingTonic", () => {
  it("is the tonic nearest the note before", () => {
    expect(closingTonic(C_MAJOR, "C", "F4")).toBe("C4");
    expect(closingTonic(C_MAJOR, "C", "G4")).toBe("C5");
    expect(closingTonic(C_MAJOR, "C", "B5")).toBe("C6");
  });

  it("is the tonic nearest the middle when there's no note before", () => {
    expect(closingTonic(C_MAJOR, "C", null)).toBe("C5");
  });

  it("is the other tonic when the nearest is out of range", () => {
    const high = ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6", "D6", "E6", "F6", "G6"];
    expect(closingTonic(high, "C", "G6")).toBe("C6");
  });
});
