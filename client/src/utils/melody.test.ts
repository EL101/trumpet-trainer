import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "@/schema";
import {
  closingTonic,
  LONG_TONE_MELODY,
  melody,
  nextPitch,
  RANDOM_MELODY,
  withinLeap,
  type MelodyStyle,
} from "./melody";

/** C major from C4 to C6, the Medium range. */
const C_MAJOR = ["C", "D", "E", "F", "G", "A", "B"].flatMap((n) => [`${n}4`, `${n}5`]).concat("C6");
C_MAJOR.sort((a, b) => Note.midi(a)! - Note.midi(b)!);

/** Many 40-note melodies, as the scale steps between each note and the next. */
function intervals(style: MelodyStyle) {
  const steps: number[] = [];
  const melodies: string[][] = [];
  for (let run = 0; run < 200; run++) {
    const played: string[] = [];
    for (let k = 0; k < 40; k++) played.push(nextPitch(C_MAJOR, played, style));
    played.slice(1).forEach((pitch, i) => {
      steps.push(C_MAJOR.indexOf(pitch) - C_MAJOR.indexOf(played[i]));
    });
    melodies.push(played);
  }
  return { steps, melodies };
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const stepShare = (style: MelodyStyle) => {
  const sizes = intervals(style).steps.map(Math.abs);
  return sizes.filter((size) => size === 1).length / sizes.length;
};

describe("withinLeap", () => {
  it("allows up to a fifth at low difficulty, but not the tritone", () => {
    expect(withinLeap(7, RANDOM_MELODY.LOW)).toBe(true);
    expect(withinLeap(-7, RANDOM_MELODY.LOW)).toBe(true);
    expect(withinLeap(8, RANDOM_MELODY.LOW)).toBe(false);
    expect(withinLeap(6, RANDOM_MELODY.LOW)).toBe(false);
  });

  it("allows up to an octave at medium, and an octave and a fifth at high", () => {
    expect(withinLeap(6, RANDOM_MELODY.MED)).toBe(true);
    expect(withinLeap(12, RANDOM_MELODY.MED)).toBe(true);
    expect(withinLeap(13, RANDOM_MELODY.MED)).toBe(false);
    expect(withinLeap(19, RANDOM_MELODY.HIGH)).toBe(true);
    expect(withinLeap(20, RANDOM_MELODY.HIGH)).toBe(false);
  });
});

describe("nextPitch", () => {
  it("steps back the other way after a leap of a fourth or more", () => {
    for (let run = 0; run < 50; run++) {
      expect(nextPitch(C_MAJOR, ["C4", "G4"], RANDOM_MELODY.LOW)).toBe("F4");
      expect(nextPitch(C_MAJOR, ["C5", "F4"], RANDOM_MELODY.MED)).toBe("G4");
    }
  });

  it("carries on as usual when the step back is out of range", () => {
    for (let run = 0; run < 50; run++) {
      const next = nextPitch(C_MAJOR, ["G4", "C4"], RANDOM_MELODY.LOW);
      expect(withinLeap(Note.midi(next)! - Note.midi("C4")!, RANDOM_MELODY.LOW)).toBe(true);
    }
  });

  it("keeps to the style's leap", () => {
    for (const style of [...Object.values(RANDOM_MELODY), ...Object.values(LONG_TONE_MELODY)]) {
      for (let run = 0; run < 200; run++) {
        const next = nextPitch(C_MAJOR, ["F4"], style);
        expect(withinLeap(Note.midi(next)! - Note.midi("F4")!, style)).toBe(true);
      }
    }
  });

  it("only picks allowed notes when it can", () => {
    for (let run = 0; run < 50; run++) {
      expect(nextPitch(C_MAJOR, ["F4"], RANDOM_MELODY.LOW, (p) => p === "A4")).toBe("A4");
      // Nothing allowed is in reach, so it picks as if nothing were ruled out.
      const next = nextPitch(C_MAJOR, ["F4"], RANDOM_MELODY.LOW, (p) => p === "C6");
      expect(withinLeap(Note.midi(next)! - Note.midi("F4")!, RANDOM_MELODY.LOW)).toBe(true);
    }
  });

  it("moves by step more than by any other interval", () => {
    for (const style of [...Object.values(RANDOM_MELODY), ...Object.values(LONG_TONE_MELODY)]) {
      const sizes = intervals(style).steps.map(Math.abs);
      const share = (size: number) => sizes.filter((s) => s === size).length / sizes.length;
      for (let size = 0; size <= 7; size++) {
        if (size !== 1) expect(share(1)).toBeGreaterThan(share(size));
      }
    }
  });

  it("moves by step about 35% of the time in random exercises at high difficulty", () => {
    const steps = stepShare(RANDOM_MELODY.HIGH);
    expect(steps).toBeGreaterThan(0.3);
    expect(steps).toBeLessThan(0.4);
  });

  it("leaps wider as the difficulty rises", () => {
    const leap = (style: MelodyStyle) => mean(intervals(style).steps.map(Math.abs));
    const [low, med, high] = DIFFICULTIES.map((d) => leap(RANDOM_MELODY[d]));
    expect(low).toBeLessThan(med);
    expect(med).toBeLessThan(high);
    expect(leap(LONG_TONE_MELODY.LOW)).toBeLessThan(leap(LONG_TONE_MELODY.HIGH));
  });

  it("moves by step more in long tones than in random exercises", () => {
    for (const difficulty of ["LOW", "HIGH"] as const) {
      expect(stepShare(LONG_TONE_MELODY[difficulty])).toBeGreaterThan(
        stepShare(RANDOM_MELODY[difficulty]),
      );
    }
  });

  it("only sometimes steps back after a leap of a sixth or more at high difficulty", () => {
    let leaps = 0;
    let recovered = 0;
    intervals(RANDOM_MELODY.HIGH).steps.forEach((step, i, steps) => {
      if (Math.abs(step) < 5 || i + 1 >= steps.length || i % 39 === 38) return;
      leaps++;
      if (steps[i + 1] === -Math.sign(step)) recovered++;
    });
    expect(recovered / leaps).toBeGreaterThan(0.5);
    expect(recovered / leaps).toBeLessThan(0.85);
  });

  it("keeps low long tones nearer the middle of the range than high ones", () => {
    // C4 to C6: the outer half is below F#4 and above F#5.
    const outerShare = (style: MelodyStyle) => {
      const notes = intervals(style).melodies.flat();
      return notes.filter((p) => Math.abs(Note.midi(p)! - 72) > 6).length / notes.length;
    };
    const low = outerShare(LONG_TONE_MELODY.LOW);
    expect(low).toBeLessThan(0.35);
    expect(low).toBeLessThan(outerShare(LONG_TONE_MELODY.HIGH));
  });

  it("spends more time in the middle of the range than at the edges", () => {
    const notes = intervals(RANDOM_MELODY.HIGH).melodies.flat();
    // C4 to C6: the middle half runs from F#4 to F#5.
    const inMiddle = notes.filter((p) => Math.abs(Note.midi(p)! - 72) <= 6).length;
    expect(inMiddle / notes.length).toBeGreaterThan(0.55);
  });
});

describe("melody", () => {
  const lengths = Array.from({ length: 30 }, () => 4);

  it("gives each length a note, with no rests unless asked for", () => {
    const events = melody(lengths, C_MAJOR, "C", LONG_TONE_MELODY.HIGH);
    expect(events.map((e) => e.quarters)).toEqual(lengths);
    expect(events.every((e) => e.pitch !== null)).toBe(true);
  });

  it("rests now and then when asked to, but never on the last note", () => {
    const runs = Array.from({ length: 20 }, () =>
      melody(lengths, C_MAJOR, "C", RANDOM_MELODY.MED, 0.2),
    );
    expect(runs.some((events) => events.some((e) => e.pitch === null))).toBe(true);
    expect(runs.every((events) => events.at(-1)!.pitch !== null)).toBe(true);
  });

  it("reaches the closing tonic within the style's leap", () => {
    for (let run = 0; run < 200; run++) {
      const events = melody(lengths, C_MAJOR, "C", LONG_TONE_MELODY.LOW);
      const [before, last] = events.slice(-2).map((e) => Note.midi(e.pitch!)!);
      expect(Note.pitchClass(events.at(-1)!.pitch!)).toBe("C");
      expect(withinLeap(last - before, LONG_TONE_MELODY.LOW)).toBe(true);
    }
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
