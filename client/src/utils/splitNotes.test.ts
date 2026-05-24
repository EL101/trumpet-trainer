import { describe, it, expect } from "vitest";
import { splitNotes } from "./splitNotes";

describe("splitNotes", () => {
  // ============================================================
  // BASIC MEASURE SPLITTING
  // ============================================================
  describe("basic measure splitting", () => {
    it("returns one measure when notes exactly fill one 4/4 measure", () => {
      const result = splitNotes("C4/q, D4, E4, F4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("C4/q, D4, E4, F4");
    });

    it("splits 8 quarter notes into two 4/4 measures", () => {
      const result = splitNotes("C4/q, D4, E4, F4, G4, A4, B4, C5", "4/4");
      expect(result).toHaveLength(2);
      expect(result[0]).toBe("C4/q, D4, E4, F4");
      expect(result[1]).toBe("G4/q, A4, B4, C5");
    });

    it("splits 12 quarter notes into three 4/4 measures", () => {
      const result = splitNotes(
        "C4/q, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5",
        "4/4"
      );
      expect(result).toHaveLength(3);
    });

    it("handles a single whole note as one 4/4 measure", () => {
      const result = splitNotes("C4/w", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("C4/w");
      expect(result[0]).not.toContain("/r");
    });

    it("splits two whole notes into two 4/4 measures", () => {
      const result = splitNotes("C4/w, D4/w", "4/4");
      expect(result).toHaveLength(2);
      expect(result[0]).toBe("C4/w");
      expect(result[1]).toBe("D4/w");
    });

    it("handles two half notes filling one 4/4 measure", () => {
      const result = splitNotes("C4/h, D4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe("C4/h, D4");
    });

    it("splits four half notes into two 4/4 measures", () => {
      const result = splitNotes("C4/h, D4, E4, F4", "4/4");
      expect(result).toHaveLength(2);
    });
  });

  // ============================================================
  // DURATION CASCADE
  // ============================================================
  describe("duration cascade", () => {
    it("subsequent notes inherit the duration of the previous explicit duration", () => {
      // All four should be quarter notes
      const result = splitNotes("C4/q, D4, E4, F4", "4/4");
      expect(result).toHaveLength(1);
    });

    it("duration changes mid-sequence", () => {
      // C4 is quarter (1 beat), D4 is half (2 beats), E4 inherits half (2 beats)
      // total = 5 beats, should throw because 5 > 4
      expect(() => splitNotes("C4/q, D4/h, E4", "4/4")).toThrow();
    });

    it("duration changes from half to quarter mid-sequence", () => {
      // C4/h = 2 beats, D4/q = 1 beat, E4 inherits q = 1 beat = 4 total
      const result = splitNotes("C4/h, D4/q, E4", "4/4");
      expect(result).toHaveLength(1);
    });

    it("cascades eighth note duration", () => {
      // 8 eighth notes = 4 beats = one 4/4 measure
      const result = splitNotes("C4/8, D4, E4, F4, G4, A4, B4, C5", "4/4");
      expect(result).toHaveLength(1);
    });

    it("cascades sixteenth note duration", () => {
      // 16 sixteenth notes = 4 beats = one 4/4 measure
      const notes = Array(16).fill("C4").join(", ");
      const result = splitNotes(`C4/16, ${notes.split(", ").slice(1).join(", ")}`, "4/4");
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // DOTTED NOTES
  // ============================================================
  describe("dotted notes", () => {
    it("handles dotted half note (3 beats) + quarter note (1 beat) in 4/4", () => {
      const result = splitNotes("C4/h., D4/q", "4/4");
      expect(result).toHaveLength(1);
    });

    it("handles dotted quarter note (1.5 beats)", () => {
      // dotted quarter (1.5) + eighth (0.5) + quarter (1) + quarter (1) = 4
      const result = splitNotes("C4/q., D4/8, E4/q, F4", "4/4");
      expect(result).toHaveLength(1);
    });

    it("handles dotted eighth note (0.75 beats)", () => {
      // dotted eighth (0.75) + sixteenth (0.25) = 1 beat, need 4 beats total
      const result = splitNotes("C4/8., D4/16, E4/q, F4, G4", "4/4");
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // REST PADDING
  // ============================================================
  describe("rest padding for incomplete measures", () => {
    it("pads a single quarter note with rests to fill 4/4", () => {
      const result = splitNotes("C4/q", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("C4/q");
      expect(result[0]).toContain("/r");
    });

    it("pads two quarter notes with a half rest", () => {
      const result = splitNotes("C4/q, D4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("/r");
    });

    it("pads three quarter notes with a quarter rest", () => {
      const result = splitNotes("C4/q, D4, E4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("/r");
    });

    it("does not pad a complete measure", () => {
      const result = splitNotes("C4/q, D4, E4, F4", "4/4");
      expect(result[0]).not.toContain("/r");
    });

    it("only pads the last measure when previous measures are full", () => {
      // 5 quarter notes: first measure full (4), second measure has 1 + rests
      const result = splitNotes("C4/q, D4, E4, F4, G4", "4/4");
      expect(result).toHaveLength(2);
      expect(result[0]).not.toContain("/r");
      expect(result[1]).toContain("/r");
    });

    it("pads a single eighth note with rests in 4/4", () => {
      const result = splitNotes("C4/8", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("C4/8");
      expect(result[0]).toContain("/r");
    });

    it("rest padding produces valid VexFlow rest syntax with /r", () => {
      const result = splitNotes("C4/q", "4/4");
      const rests = result[0].split(", ").filter((n) => n.includes("/r"));
      // Every rest should match B4/{duration}/r or B4/{duration}/r.
      for (const rest of rests) {
        expect(rest).toMatch(/^B4\/\w+\/r\.?$/);
      }
    });

    it("dotted rests use . after /r", () => {
      // dotted quarter = 1.5 beats, leaves 2.5 beats in 4/4
      // 2.5 = half (2) + eighth (0.5), so should produce rests without dots
      // But for 1.5 remaining: should produce a dotted quarter rest
      const result = splitNotes("C4/h, D4/8", "4/4");
      // remaining = 1.5 beats, should be a dotted quarter rest
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("/r");
    });

    it("total beats of notes + rests equals the measure length", () => {
      const DURATION_TO_BEATS: Record<string, number> = {
        w: 4, h: 2, q: 1, "8": 0.5, "16": 0.25, "32": 0.125,
        "w.": 6, "h.": 3, "q.": 1.5, "8.": 0.75, "16.": 0.375,
      };

      const result = splitNotes("C4/q, D4, E4", "4/4");
      const parts = result[0].split(", ");
      let totalBeats = 0;
      let lastDur = "";
      for (const part of parts) {
        const slashes = part.split("/");
        // eslint-disable-next-line no-useless-assignment
        let dur = "";
        if (slashes.length >= 2) {
          dur = slashes[1];
        } else {
          dur = lastDur;
        }
        // Remove 'r' from rest durations for beat lookup
        // dur could be like "q" or rest notation handled differently
        totalBeats += DURATION_TO_BEATS[dur] ?? 0;
        lastDur = dur;
      }
      expect(totalBeats).toBeCloseTo(4, 5);
    });
  });

  // ============================================================
  // DIFFERENT TIME SIGNATURES
  // ============================================================
  describe("different time signatures", () => {
    it("handles 3/4 time — 3 quarter notes fill one measure", () => {
      const result = splitNotes("C4/q, D4, E4", "3/4");
      expect(result).toHaveLength(1);
      expect(result[0]).not.toContain("/r");
    });

    it("handles 3/4 time — 6 quarter notes fill two measures", () => {
      const result = splitNotes("C4/q, D4, E4, F4, G4, A4", "3/4");
      expect(result).toHaveLength(2);
    });

    it("handles 2/4 time", () => {
      const result = splitNotes("C4/q, D4", "2/4");
      expect(result).toHaveLength(1);
      expect(result[0]).not.toContain("/r");
    });

    it("handles 6/8 time — 6 eighth notes fill one measure", () => {
      const result = splitNotes("C4/8, D4, E4, F4, G4, A4", "6/8");
      expect(result).toHaveLength(1);
    });

    it("handles 2/2 time (cut time) — 2 half notes fill one measure", () => {
      const result = splitNotes("C4/h, D4", "2/2");
      expect(result).toHaveLength(1);
    });

    it("pads incomplete measure in 3/4 time", () => {
      const result = splitNotes("C4/q", "3/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("/r");
    });

    it("pads incomplete measure in 6/8 time", () => {
      const result = splitNotes("C4/8, D4, E4", "6/8");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("/r");
    });
  });

  // ============================================================
  // ACCIDENTALS
  // ============================================================
  describe("accidentals", () => {
    it("handles sharps", () => {
      const result = splitNotes("C#4/q, D#4, E4, F#4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("C#4");
      expect(result[0]).toContain("D#4");
      expect(result[0]).toContain("F#4");
    });

    it("handles flats", () => {
      const result = splitNotes("Bb4/q, Eb4, Ab4, Db4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("Bb4");
      expect(result[0]).toContain("Eb4");
    });

    it("handles double sharps", () => {
      const result = splitNotes("C##4/q, D4, E4, F4", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("C##4");
    });

    it("accidentals don't affect duration parsing", () => {
      // Make sure the / split doesn't get confused by accidentals
      const result = splitNotes("C#5/q, B4, A4, G#4", "4/4");
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // MIXED DURATIONS ACROSS MEASURES
  // ============================================================
  describe("mixed durations across measures", () => {
    it("handles duration change at measure boundary", () => {
      // Measure 1: C4/q D4 E4 F4 (4 beats)
      // Measure 2: G4/h A4 (4 beats)
      const result = splitNotes("C4/q, D4, E4, F4, G4/h, A4", "4/4");
      expect(result).toHaveLength(2);
    });

    it("handles mixed eighth and quarter notes", () => {
      // q(1) + q(1) + 8(0.5) + 8(0.5) + q(1) = 4 beats
      const result = splitNotes("C4/q, D4, E4/8, F4, G4/q", "4/4");
      expect(result).toHaveLength(1);
    });

    it("handles half note followed by eighth notes", () => {
      // h(2) + 8(0.5)*4 = 4 beats
      const result = splitNotes("C4/h, D4/8, E4, F4, G4", "4/4");
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // ERROR HANDLING
  // ============================================================
  describe("error handling", () => {
    it("throws when a note causes beats to exceed measure without hitting it exactly", () => {
      // 3 quarters (3 beats) + 1 half (2 beats) = 5, jumps past 4
      expect(() => splitNotes("C4/q, D4, E4, F4/h", "4/4")).toThrow(
        "Invalid note sequence"
      );
    });

    it("throws in 3/4 when beats overshoot", () => {
      // 2 quarters (2 beats) + 1 half (2 beats) = 4, jumps past 3
      expect(() => splitNotes("C4/q, D4, E4/h", "3/4")).toThrow();
    });

    it("does NOT throw for 5 quarter notes in 4/4 — splits and pads instead", () => {
      const result = splitNotes("C4/q, D4, E4, F4, G4", "4/4");
      expect(result).toHaveLength(2);
      expect(result[0]).not.toContain("/r");
      expect(result[1]).toContain("/r");
    });

    it("does NOT throw for whole + quarter — splits into two measures", () => {
      const result = splitNotes("C4/w, D4/q", "4/4");
      expect(result).toHaveLength(2);
      expect(result[1]).toContain("D4");
      expect(result[1]).toContain("/r");
    });

    it("does NOT throw for 4 quarters in 3/4 — splits and pads", () => {
      const result = splitNotes("C4/q, D4, E4, F4", "3/4");
      expect(result).toHaveLength(2);
      expect(result[1]).toContain("/r");
    });
  });

  // ============================================================
  // OCTAVE RANGES
  // ============================================================
  describe("different octaves", () => {
    it("handles low octaves", () => {
      const result = splitNotes("C2/q, D2, E2, F2", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("C2");
    });

    it("handles high octaves", () => {
      const result = splitNotes("C7/q, D7, E7, F7", "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("C7");
    });
  });

  // ============================================================
  // OUTPUT FORMAT
  // ============================================================
  describe("output format", () => {
    it("each measure is a comma-separated string", () => {
      const result = splitNotes("C4/q, D4, E4, F4", "4/4");
      const parts = result[0].split(", ");
      expect(parts.length).toBeGreaterThanOrEqual(1);
    });

    it("first note in each measure retains its explicit duration", () => {
      const result = splitNotes("C4/q, D4, E4, F4, G4, A4, B4, C5", "4/4");
      // Second measure's first note should have a duration
      expect(result[1]).toMatch(/^[A-G][#b]?\d\/\w/);
    });

    it("notes without explicit duration in the original are given one at measure start", () => {
      // D4 inherits /q from C4, but when it starts a new measure it should get /q explicitly
      const result = splitNotes("C4/q, D4, E4, F4, G4, A4, B4, C5", "4/4");
      expect(result[1].startsWith("G4/q") || result[1].startsWith("G4")).toBe(true);
    });

    it("rests use B4 as the pitch", () => {
      const result = splitNotes("C4/q", "4/4");
      const rests = result[0].split(", ").filter((n) => n.includes("/r"));
      for (const rest of rests) {
        expect(rest).toMatch(/^B4\//);
      }
    });
  });

  // ============================================================
  // FLOATING POINT EDGE CASES
  // ============================================================
  describe("floating point precision", () => {
    it("handles sequences of dotted eighths without float errors", () => {
      // 4 dotted eighths = 4 * 0.75 = 3 beats in 3/4
      const result = splitNotes("C4/8., D4, E4, F4", "3/4");
      expect(result).toHaveLength(1);
    });

    it("handles many eighth notes without accumulation error", () => {
      // 8 eighth notes = exactly 4 beats
      const result = splitNotes(
        "C4/8, D4, E4, F4, G4, A4, B4, C5",
        "4/4"
      );
      expect(result).toHaveLength(1);
      expect(result[0]).not.toContain("/r");
    });

    it("handles many sixteenth notes without accumulation error", () => {
      // 16 sixteenth notes = exactly 4 beats
      const sixteenths = Array.from({ length: 15 }, (_, i) => 
        ["C4", "D4", "E4", "F4", "G4", "A4", "B4"][i % 7]
      ).join(", ");
      const result = splitNotes(`C4/16, ${sixteenths}`, "4/4");
      expect(result).toHaveLength(1);
      expect(result[0]).not.toContain("/r");
    });
  });
});

// ============================================================
// STRESS TESTS — EXACT OUTPUT
// ============================================================
describe("stress tests — exact output", () => {
  // ---- Complete measures: full exact strings ----

  it("4 quarter notes in 4/4 produce exact measure string", () => {
    const result = splitNotes("C4/q, D4, E4, F4", "4/4");
    expect(result).toEqual(["C4/q, D4, E4, F4"]);
  });

  it("8 quarter notes in 4/4 produce two exact measure strings", () => {
    const result = splitNotes("C4/q, D4, E4, F4, G4, A4, B4, C5", "4/4");
    expect(result).toEqual(["C4/q, D4, E4, F4", "G4/q, A4, B4, C5"]);
  });

  it("12 quarter notes in 4/4 produce three exact measure strings", () => {
    const result = splitNotes(
      "C4/q, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5",
      "4/4"
    );
    expect(result).toEqual([
      "C4/q, D4, E4, F4",
      "G4/q, A4, B4, C5",
      "D5/q, E5, F5, G5",
    ]);
  });

  it("4 half notes in 4/4 produce two exact measure strings", () => {
    const result = splitNotes("C4/h, D4, E4, F4", "4/4");
    expect(result).toEqual(["C4/h, D4", "E4/h, F4"]);
  });

  it("2 whole notes in 4/4 produce two exact measure strings", () => {
    const result = splitNotes("C4/w, D4/w", "4/4");
    expect(result).toEqual(["C4/w", "D4/w"]);
  });

  it("dotted half + quarter in 4/4 produce exact measure string", () => {
    const result = splitNotes("C4/h., D4/q", "4/4");
    expect(result).toEqual(["C4/h., D4/q"]);
  });

  it("dotted quarter + eighth + quarter + quarter in 4/4 produce exact string", () => {
    const result = splitNotes("C4/q., D4/8, E4/q, F4", "4/4");
    expect(result).toEqual(["C4/q., D4/8, E4/q, F4"]);
  });

  it("dotted eighth + sixteenth + 3 quarters produce exact string", () => {
    const result = splitNotes("C4/8., D4/16, E4/q, F4, G4", "4/4");
    expect(result).toEqual(["C4/8., D4/16, E4/q, F4, G4"]);
  });

  it("mixed eighth and quarter notes produce exact string", () => {
    const result = splitNotes("C4/q, D4, E4/8, F4, G4/q", "4/4");
    expect(result).toEqual(["C4/q, D4, E4/8, F4, G4/q"]);
  });

  it("half + 4 eighth notes produce exact string", () => {
    const result = splitNotes("C4/h, D4/8, E4, F4, G4", "4/4");
    expect(result).toEqual(["C4/h, D4/8, E4, F4, G4"]);
  });

  it("duration change at measure boundary produces exact strings", () => {
    const result = splitNotes("C4/q, D4, E4, F4, G4/h, A4", "4/4");
    expect(result).toEqual(["C4/q, D4, E4, F4", "G4/h, A4"]);
  });

  it("quarter + half + quarter filling 4/4 produces exact string", () => {
    const result = splitNotes("C4/q, D4/h, E4/q", "4/4");
    expect(result).toEqual(["C4/q, D4/h, E4/q"]);
  });

  it("6 eighths in 6/8 produce exact full measure string", () => {
    const result = splitNotes("C4/8, D4, E4, F4, G4, A4", "6/8");
    expect(result).toEqual(["C4/8, D4, E4, F4, G4, A4"]);
  });

  it("3 quarters in 3/4 produce exact full measure string", () => {
    const result = splitNotes("C4/q, D4, E4", "3/4");
    expect(result).toEqual(["C4/q, D4, E4"]);
  });

  it("6 quarters in 3/4 produce two exact measure strings", () => {
    const result = splitNotes("C4/q, D4, E4, F4, G4, A4", "3/4");
    expect(result).toEqual(["C4/q, D4, E4", "F4/q, G4, A4"]);
  });

  // ---- Rest padding: full exact strings ----

  it("1 quarter in 4/4 pads with a dotted half rest", () => {
    const result = splitNotes("C4/q", "4/4");
    expect(result).toEqual(["C4/q, B4/h/r."]);
  });

  it("2 quarters in 4/4 pad with a half rest", () => {
    const result = splitNotes("C4/q, D4", "4/4");
    expect(result).toEqual(["C4/q, D4, B4/h/r"]);
  });

  it("3 quarters in 4/4 pad with a quarter rest", () => {
    const result = splitNotes("C4/q, D4, E4", "4/4");
    expect(result).toEqual(["C4/q, D4, E4, B4/q/r"]);
  });

  it("1 eighth in 4/4 pads with two quarter rests and a dotted quarter rest", () => {
    const result = splitNotes("C4/8", "4/4");
    expect(result).toEqual(["C4/8, B4/q/r, B4/q/r, B4/q/r."]);
  });

  it("half + eighth in 4/4 pads with a dotted quarter rest", () => {
    const result = splitNotes("C4/h, D4/8", "4/4");
    expect(result).toEqual(["C4/h, D4/8, B4/q/r."]);
  });

  it("5 quarters in 4/4: first measure exact, second padded with dotted half rest", () => {
    const result = splitNotes("C4/q, D4, E4, F4, G4", "4/4");
    expect(result).toEqual(["C4/q, D4, E4, F4", "G4/q, B4/h/r."]);
  });

  it("1 quarter in 3/4 pads with a half rest", () => {
    const result = splitNotes("C4/q", "3/4");
    expect(result).toEqual(["C4/q, B4/h/r"]);
  });

  it("2 quarters in 3/4 pad with a quarter rest", () => {
    const result = splitNotes("C4/q, D4", "3/4");
    expect(result).toEqual(["C4/q, D4, B4/q/r"]);
  });

  it("3 eighths in 6/8 pad with a dotted quarter rest", () => {
    const result = splitNotes("C4/8, D4, E4", "6/8");
    expect(result).toEqual(["C4/8, D4, E4, B4/q/r."]);
  });

  it("4 quarters in 3/4 split and pad second measure with a half rest", () => {
    const result = splitNotes("C4/q, D4, E4, F4", "3/4");
    expect(result).toEqual(["C4/q, D4, E4", "F4/q, B4/h/r"]);
  });

  it("whole + quarter in 4/4 split into two measures, second padded", () => {
    const result = splitNotes("C4/w, D4/q", "4/4");
    expect(result).toEqual(["C4/w", "D4/q, B4/h/r."]);
  });
});

describe("12/8 time signature", () => {
  // In 12/8: measureLength = 12, noteValue = 8
  // An eighth note = 1 unit, quarter = 2, dotted quarter = 3,
  // half = 4, dotted half = 6, whole = 8

  // ---- Basic filling ----

  it("12 eighth notes fill one measure — exact string", () => {
    const notes = "C4/8, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5";
    const result = splitNotes(notes, "12/8");
    expect(result).toEqual(["C4/8, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5"]);
  });

  it("6 quarter notes fill one measure — exact string", () => {
    const result = splitNotes("C4/q, D4, E4, F4, G4, A4", "12/8");
    expect(result).toEqual(["C4/q, D4, E4, F4, G4, A4"]);
  });

  it("4 dotted quarter notes fill one measure — exact string", () => {
    const result = splitNotes("C4/q., D4, E4, F4", "12/8");
    expect(result).toEqual(["C4/q., D4, E4, F4"]);
  });

  it("3 half notes fill one measure — exact string", () => {
    const result = splitNotes("C4/h, D4, E4", "12/8");
    expect(result).toEqual(["C4/h, D4, E4"]);
  });

  it("2 dotted half notes fill one measure — exact string", () => {
    const result = splitNotes("C4/h., D4", "12/8");
    expect(result).toEqual(["C4/h., D4"]);
  });

  it("1 whole + 1 half fills one measure (8 + 4 = 12) — exact string", () => {
    const result = splitNotes("C4/w, D4/h", "12/8");
    expect(result).toEqual(["C4/w, D4/h"]);
  });

  // ---- Multiple measures ----

  it("24 eighth notes split into two measures — exact strings", () => {
    const eighths = Array.from({ length: 24 }, (_, i) =>
      ["C4", "D4", "E4", "F4", "G4", "A4", "B4"][i % 7]
    );
    eighths[0] = "C4/8";
    const result = splitNotes(eighths.join(", "), "12/8");
    expect(result).toEqual([
      "C4/8, D4, E4, F4, G4, A4, B4, C4, D4, E4, F4, G4",
      "A4/8, B4, C4, D4, E4, F4, G4, A4, B4, C4, D4, E4",
    ]);
  });

  it("8 dotted quarter notes split into two measures — exact strings", () => {
    const result = splitNotes(
      "C4/q., D4, E4, F4, G4, A4, B4, C5",
      "12/8"
    );
    expect(result).toEqual(["C4/q., D4, E4, F4", "G4/q., A4, B4, C5"]);
  });

  it("12 quarter notes split into two measures — exact strings", () => {
    const quarters = Array.from({ length: 12 }, (_, i) =>
      ["C4", "D4", "E4", "F4", "G4", "A4", "B4"][i % 7]
    );
    quarters[0] = "C4/q";
    const result = splitNotes(quarters.join(", "), "12/8");
    expect(result).toEqual([
      "C4/q, D4, E4, F4, G4, A4",
      "B4/q, C4, D4, E4, F4, G4",
    ]);
  });

  // ---- Mixed durations ----

  it("handles dotted quarter + eighth pattern (typical 12/8 feel) — exact strings", () => {
    const result = splitNotes(
      "C4/q., D4/8, E4/q., F4/8, G4/q., A4/8, B4/q., C5/8, D5/q., E5/8, F5/q., G5/8",
      "12/8"
    );
    expect(result).toEqual([
      "C4/q., D4/8, E4/q., F4/8, G4/q., A4/8",
      "B4/q., C5/8, D5/q., E5/8, F5/q., G5/8",
    ]);
  });

  it("handles dotted half + dotted quarter + dotted quarter (6+3+3=12) — exact string", () => {
    const result = splitNotes("C4/h., D4/q., E4", "12/8");
    expect(result).toEqual(["C4/h., D4/q., E4"]);
  });

  it("handles whole + dotted quarter + eighth (8+3+1=12) — exact string", () => {
    const result = splitNotes("C4/w, D4/q., E4/8", "12/8");
    expect(result).toEqual(["C4/w, D4/q., E4/8"]);
  });

  it("handles half + quarter + dotted quarter + dotted quarter (4+2+3+3=12) — exact string", () => {
    const result = splitNotes("C4/h, D4/q, E4/q., F4", "12/8");
    expect(result).toEqual(["C4/h, D4/q, E4/q., F4"]);
  });

  // ---- Rest padding ----

  it("pads a single eighth note with rests", () => {
    const result = splitNotes("C4/8", "12/8");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("C4/8");
    expect(result[0]).toContain("/r");
  });

  it("pads a single dotted quarter with rests", () => {
    const result = splitNotes("C4/q.", "12/8");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("/r");
  });

  it("pads a single whole note with rests (4 units remaining)", () => {
    const result = splitNotes("C4/w", "12/8");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("C4/w");
    expect(result[0]).toContain("/r");
  });

  it("pads a dotted half note with rests (6 units remaining)", () => {
    const result = splitNotes("C4/h.", "12/8");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("/r");
  });

  it("second measure is padded when incomplete", () => {
    // First measure: 4 dotted quarters (12 units, full)
    // Second measure: 1 dotted quarter (3 units, needs padding)
    const result = splitNotes("C4/q., D4, E4, F4, G4", "12/8");
    expect(result).toHaveLength(2);
    expect(result[0]).not.toContain("/r");
    expect(result[1]).toContain("/r");
  });

  // ---- Error cases ----

  it("throws when a note overshoots the measure boundary", () => {
    // 5 dotted quarters = 15 units, overshoots 12 at note 5 (12 + 3 > 12, but
    // actually 4 dotted quarters = 12, so the 5th starts a new measure)
    // Let's do: 3 half notes (12) then a half (4) — that's a new measure, no throw.
    // Real throw: 11 eighths + 1 half = 11 + 4 = 15, jumps past 12
    const elevenEighths = Array(11).fill("C4").join(", ");
    expect(() =>
      splitNotes(`C4/8, ${elevenEighths.split(", ").slice(1).join(", ")}, D4/h`, "12/8")
    ).toThrow();
  });

  it("does NOT throw when notes split cleanly across measures", () => {
    // 5 half notes: 4+4+4+4+4 = first measure uses 3 halves (12), second has 2 (8) + pad
    const result = splitNotes("C4/h, D4, E4, F4, G4", "12/8");
    expect(result).toHaveLength(2);
    expect(result[1]).toContain("/r");
  });

  // ---- Accidentals in 12/8 ----

  it("handles accidentals in 12/8", () => {
    const result = splitNotes("C#4/q., Bb4, Eb5, F#4", "12/8");
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("C#4");
    expect(result[0]).toContain("Bb4");
    expect(result[0]).toContain("Eb5");
    expect(result[0]).toContain("F#4");
  });
});