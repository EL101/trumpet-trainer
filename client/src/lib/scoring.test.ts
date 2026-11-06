import { describe, expect, it } from "vitest";
import { notePlace, overallScore, scoreRun, type PitchSample } from "./scoring";
import { buildTimeline } from "./timeline";
import { CONCERT_OFFSET } from "./tuning";

/** Frames a quarter note: 60 a second at ♩ = 120. */
const FRAMES_PER_QUARTER = 30;

type Sound = {
  /** Written pitch as a MIDI number. */
  midi: number;
  from: number;
  to: number;
  /** How far off the written pitch, in cents: a number, or one for each moment. */
  cents?: number | ((at: number) => number);
};

/** What the microphone hears from `sounds` across `length` quarter notes; silence between. */
function hear(length: number, ...sounds: Sound[]): PitchSample[] {
  const samples: PitchSample[] = [];
  for (let f = 0; f < length * FRAMES_PER_QUARTER; f++) {
    const at = f / FRAMES_PER_QUARTER;
    const sound = sounds.find((s) => s.from <= at && at < s.to);
    if (!sound) {
      samples.push({ at, hz: 0, clarity: 0.2, level: 0.001 });
      continue;
    }
    const cents = typeof sound.cents === "function" ? sound.cents(at) : (sound.cents ?? 0);
    const concert = sound.midi + CONCERT_OFFSET + cents / 100;
    samples.push({ at, hz: 440 * 2 ** ((concert - 69) / 12), clarity: 0.97, level: 0.2 });
  }
  return samples;
}

/** Each note played as written: on its beat, for 90% of its length (tongued apart). */
function asWritten(
  notes: string,
  timeSig = "4/4",
  change: (s: Sound, i: number) => Sound = (s) => s,
) {
  const timeline = buildTimeline(notes, timeSig);
  const sounds = timeline.notes
    .filter((n) => n.midi !== null)
    .map((n, i) => change({ midi: n.midi!, from: n.start, to: n.start + n.length * 0.9 }, i));
  return { timeline, samples: hear(timeline.end, ...sounds) };
}

const SCALE = "C4/q, D4, E4, F4, G4, A4, B4, C5";
/** 4/4 at ♩ = 120. */
const TIMING = { beat: 1, secondsPerQuarter: 0.5 };

describe("scoreRun", () => {
  it("gives full marks, with nothing to say, for a run played as written", () => {
    const { timeline, samples } = asWritten(SCALE);
    const run = scoreRun(timeline, samples, TIMING);

    expect(run.heard).toBe(true);
    expect(run.overall).toBe(100);
    for (const part of Object.values(run.parts)) {
      expect(part).toEqual({ score: 100, notes: [] });
    }
    expect(run.ghosts).toEqual([]);
    expect(run.cents.slice(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("never says a wrong note was played as the note written", () => {
    // Under half on C4, and as many frames on D4 as on E♭4: the tie must not land on C4.
    const timeline = buildTimeline("C4/q", "4/4");
    const samples = hear(
      1,
      { midi: 60, from: 0.25, to: 0.45 },
      { midi: 62, from: 0.45, to: 0.65 },
      { midi: 63, from: 0.65, to: 0.85 },
    );
    const run = scoreRun(timeline, samples, TIMING);

    expect(run.parts.rightNotes.notes).toEqual([
      expect.objectContaining({
        written: 60,
        played: 62,
        text: "Played D4 instead of C4, too high.",
      }),
    ]);
    // Both pitches played over the C are wrong notes, so both are drawn.
    expect(run.ghosts.map((g) => g.midi)).toEqual([62, 63]);
  });

  it("marks a wrong note with what was played, as a ghost over the written one", () => {
    const { timeline, samples } = asWritten(SCALE, "4/4", (s, i) =>
      i === 6 ? { ...s, midi: 67 } : s,
    );
    const run = scoreRun(timeline, samples, TIMING);

    expect(run.parts.rightNotes.score).toBe(88);
    expect(run.parts.rightNotes.notes).toEqual([
      {
        bar: 2,
        beat: 3,
        index: 6,
        written: 71,
        played: 67,
        playedLength: 1,
        text: "Played G4 instead of B4, too low.",
      },
    ]);
    // Drawn where it was played, for as long as it was held: a quarter note.
    expect(run.ghosts).toEqual([{ start: 6, length: 1, midi: 67 }]);
    // Not the right note, so no intonation colour.
    expect(run.cents[6]).toBeNull();
  });

  it("says when a note wasn't heard, without a ghost", () => {
    const { timeline } = asWritten(SCALE);
    const sounds = timeline.notes
      .filter((n) => n.midi !== null && n.start !== 3)
      .map((n) => ({ midi: n.midi!, from: n.start, to: n.start + 0.9 }));
    const run = scoreRun(timeline, hear(timeline.end, ...sounds), TIMING);

    expect(run.parts.rightNotes.notes).toEqual([
      { bar: 1, beat: 4, index: 3, written: 65, text: "No note heard for F4." },
    ]);
    expect(run.ghosts).toEqual([]);
    // The notes that were played are scored on their own merits.
    expect(run.parts.rhythm.score).toBe(100);
  });

  it("spells the note played to suit the key", () => {
    const { timeline, samples } = asWritten("F4/h, Bb4/h", "4/4", (s, i) =>
      i === 1 ? { ...s, midi: 68 } : s,
    );
    const text = (keySig: string) =>
      scoreRun(timeline, samples, { ...TIMING, keySig }).parts.rightNotes.notes[0].text;
    expect(text("F")).toBe("Played A♭4 instead of B♭4, too low.");
    expect(text("E")).toBe("Played G♯4 instead of B♭4, too low.");
  });

  it("names a note that's sharp or flat, without saying by how much", () => {
    const { timeline, samples } = asWritten(SCALE, "4/4", (s, i) =>
      i === 2 ? { ...s, cents: 28 } : i === 5 ? { ...s, cents: -45 } : s,
    );
    const run = scoreRun(timeline, samples, TIMING);

    expect(run.parts.intonation.notes).toEqual([
      { bar: 1, beat: 3, text: "E4 was sharp." },
      { bar: 2, beat: 2, text: "A4 was quite flat." },
    ]);
    expect(run.cents[2]).toBe(28);
    expect(run.parts.intonation.score).toBeLessThan(100);
  });

  it("puts a pitch that's off every time on one line", () => {
    const { timeline, samples } = asWritten("G4/q, C5, G4, C5, G4/w", "4/4", (s) =>
      s.midi === 72 ? { ...s, cents: 30 } : s,
    );
    expect(scoreRun(timeline, samples, TIMING).parts.intonation.notes).toEqual([
      { bar: 1, beat: 2, text: "C5 was sharp every time." },
    ]);
  });

  it("suggests moving the slide when the whole run is sharp", () => {
    const { timeline, samples } = asWritten(SCALE, "4/4", (s) => ({ ...s, cents: 22 }));
    const notes = scoreRun(timeline, samples, TIMING).parts.intonation.notes;

    expect(notes).toEqual([
      { text: "You ran sharp overall: try pulling the main tuning slide out a little." },
    ]);
  });

  it("finds notes in a row that came in late, across bars", () => {
    const { timeline, samples } = asWritten(SCALE, "4/4", (s, i) =>
      i >= 2 && i <= 5 ? { ...s, from: s.from + 0.2, to: s.to + 0.05 } : s,
    );
    const run = scoreRun(timeline, samples, TIMING);

    expect(run.parts.rhythm.notes).toEqual([
      { bar: 1, endBar: 2, text: "Dragged, coming in late." },
    ]);
    expect(run.parts.rhythm.score).toBeLessThan(100);
    expect(run.parts.rightNotes.score).toBe(100);
  });

  it("says when one note came in well early", () => {
    const { timeline, samples } = asWritten(SCALE, "4/4", (s, i) =>
      i === 3 ? { ...s, to: s.from + 0.6 } : i === 4 ? { ...s, from: s.from - 0.4 } : s,
    );
    expect(scoreRun(timeline, samples, TIMING).parts.rhythm.notes).toEqual([
      { bar: 2, beat: 1, text: "Came in well early." },
    ]);
  });

  it("says when a held note was let go early", () => {
    const { timeline, samples } = asWritten("C5/h, G4/h, C5/w", "4/4", (s, i) =>
      i === 1 ? { ...s, to: s.from + 0.8 } : s,
    );
    expect(scoreRun(timeline, samples, TIMING).parts.rhythm.notes).toEqual([
      { bar: 1, beat: 3, text: "Let go of the half note early." },
    ]);
  });

  it("hears a note that wavers, and one scooped into", () => {
    const { timeline, samples } = asWritten("C5/w, G4/w", "4/4", (s, i) =>
      i === 0
        ? { ...s, cents: (at) => 30 * Math.sin(at * 12) }
        : { ...s, cents: (at) => (at < s.from + 0.25 ? -80 : 0) },
    );
    const run = scoreRun(timeline, samples, TIMING);

    expect(run.parts.tone.notes).toEqual([
      { bar: 1, beat: 1, text: "The note wavered." },
      { bar: 2, beat: 1, text: "Scooped up into the note." },
    ]);
    expect(run.parts.tone.score).toBeLessThan(100);
  });

  it("colours every note of a tie", () => {
    const timeline = buildTimeline("C5/h~, C5/h, D5/w", "4/4");
    // The tied pair sounds as one note, held across both.
    const samples = hear(
      timeline.end,
      { midi: 72, from: 0, to: 3.8, cents: 12 },
      { midi: 74, from: 4, to: 7.6 },
    );
    expect(scoreRun(timeline, samples, TIMING).cents.slice(0, 3)).toEqual([12, 12, 0]);
  });

  it("hears nothing in silence, and scores nothing", () => {
    const timeline = buildTimeline(SCALE, "4/4");
    const run = scoreRun(timeline, hear(timeline.end), TIMING);

    expect(run.heard).toBe(false);
    expect(run.overall).toBe(0);
    expect(run.parts.rightNotes.notes).toHaveLength(5);
    expect(run.parts.rightNotes.notes[4]).toEqual({ text: "And 4 more notes after that." });
  });

  it("counts beats in the time signature's own beat", () => {
    const { timeline, samples } = asWritten("C5/8, D5, E5, F5, G5, A5", "6/8", (s, i) =>
      i === 3 ? { ...s, midi: 76 } : s,
    );
    const note = scoreRun(timeline, samples, { beat: 1.5, secondsPerQuarter: 0.5 }).parts.rightNotes
      .notes[0];
    expect(note).toMatchObject({ bar: 1, beat: 2 });
  });
});

describe("scoreRun subharmonics", () => {
  it("hears a note the detector heard a sixth or a ninth of as that note", () => {
    const { timeline, samples } = asWritten("F5/h, A5/h", "4/4");
    // F5 heard at a sixth of its frequency, A5 at a ninth: far below any trumpet note.
    const low = samples.map((s, i) =>
      s.hz ? { ...s, hz: s.hz / (s.at < 2 ? 6 : 9) } : samples[i],
    );
    const run = scoreRun(timeline, low, TIMING);

    expect(run.parts.rightNotes).toEqual({ score: 100, notes: [] });
    expect(run.ghosts).toEqual([]);
  });

  it("drops a low sound that isn't a fraction of the note due", () => {
    const timeline = buildTimeline("F5/w", "4/4");
    // A hum near B2: no multiple of it (up to ten) is near F5.
    const hum = hear(4, { midi: 47.5, from: 0, to: 3.6 });
    expect(scoreRun(timeline, hum, TIMING).parts.rightNotes.notes[0].text).toBe(
      "No note heard for F5.",
    );
  });

  it("still hears a quiet note", () => {
    const { timeline, samples } = asWritten("C5/w", "4/4");
    const quiet = samples.map((s) => (s.hz ? { ...s, level: 0.005 } : s));
    expect(scoreRun(timeline, quiet, TIMING).parts.rightNotes.score).toBe(100);
  });
});

describe("scoreRun cracks", () => {
  it("hears a note that jumps to another for a moment, but not a click-length blip", () => {
    const timeline = buildTimeline("G4/w, C5/w", "4/4");
    const samples = hear(
      timeline.end,
      { midi: 67, from: 0, to: 1.5 },
      // A fifth of a second on C5, through the G4.
      { midi: 72, from: 1.5, to: 1.9 },
      { midi: 67, from: 1.9, to: 3.6 },
      { midi: 72, from: 4, to: 5.5 },
      // Two frames of something else: the click.
      { midi: 74, from: 5.5, to: 5.55 },
      { midi: 72, from: 5.55, to: 7.6 },
    );
    expect(scoreRun(timeline, samples, TIMING).parts.tone.notes).toEqual([
      { bar: 1, beat: 1, text: "The note cracked partway through." },
    ]);
  });
});

describe("notePlace", () => {
  it("leads with the bar, and the beat when there is one", () => {
    expect(notePlace({ bar: 3, beat: 2, text: "" })).toBe("Bar 3, beat 2");
    expect(notePlace({ bar: 2, endBar: 3, text: "" })).toBe("Bars 2–3");
    expect(notePlace({ bar: 4, endBar: 4, text: "" })).toBe("Bar 4");
    expect(notePlace({ text: "" })).toBeNull();
  });
});

describe("overallScore", () => {
  it("weights right notes 40%, rhythm 30%, intonation 20% and tone 10%", () => {
    expect(overallScore({ rightNotes: 88, rhythm: 68, intonation: 94, tone: 84 })).toBe(83);
    expect(overallScore({ rightNotes: 100, rhythm: 0, intonation: 0, tone: 0 })).toBe(40);
  });
});
