import { describe, expect, it } from "vitest";
import type { PitchSample } from "./hearing";
import { buildTimeline } from "./timeline";
import { forTempo, restartPoint, toGhost, transcribe, wrongNotes } from "./transcribe";
import { CONCERT_OFFSET } from "./tuning";

/** Frames a quarter note: 60 a second at ♩ = 120. */
const FRAMES_PER_QUARTER = 30;
const SPQ = 0.5;

type Sound = { midi: number; from: number; to: number };

/** What the microphone hears from `sounds` (written pitches) across `length` quarters. */
function hear(length: number, ...sounds: Sound[]): PitchSample[] {
  return Array.from({ length: length * FRAMES_PER_QUARTER }, (_, f) => {
    const at = f / FRAMES_PER_QUARTER;
    const sound = sounds.findLast((s) => s.from <= at && at < s.to);
    if (!sound) return { at, hz: 0, clarity: 0.2, level: 0.001 };
    const hz = 440 * 2 ** ((sound.midi + CONCERT_OFFSET - 69) / 12);
    return { at, hz, clarity: 0.97, level: 0.2 };
  });
}

const near = (value: number, expected: number) => Math.abs(value - expected) < 0.05;

describe("transcribe", () => {
  it("splits a run into the notes played, where they started and ended", () => {
    const timeline = buildTimeline("C5/q, D5, E5/h", "4/4");
    const played = transcribe(
      hear(
        4,
        { midi: 72, from: 0, to: 0.9 },
        { midi: 74, from: 1, to: 1.9 },
        { midi: 76, from: 2, to: 3.8 },
      ),
      timeline,
      SPQ,
    );
    expect(played.map((p) => p.midi)).toEqual([72, 74, 76]);
    expect(near(played[1].start, 1) && near(played[1].end, 1.9)).toBe(true);
    expect(near(played[2].end - played[2].start, 1.8)).toBe(true);
  });

  it("hears a tongued repeat as two notes, and a slur as a change of note", () => {
    const timeline = buildTimeline("G4/q, G4, (C5, E5)", "4/4");
    const played = transcribe(
      hear(
        4,
        { midi: 67, from: 0, to: 0.85 },
        { midi: 67, from: 1, to: 1.85 },
        { midi: 72, from: 2, to: 3 },
        { midi: 76, from: 3, to: 3.9 },
      ),
      timeline,
      SPQ,
    );
    expect(played.map((p) => p.midi)).toEqual([67, 67, 72, 76]);
  });

  it("keeps a note going through a blip of another, and drops a stray sound", () => {
    const timeline = buildTimeline("C5/w", "4/4");
    const played = transcribe(
      hear(
        4,
        { midi: 72, from: 0, to: 3.6 },
        // Two frames of something else: the click, or a split.
        { midi: 79, from: 1.5, to: 1.56 },
      ),
      timeline,
      SPQ,
    );
    expect(played).toHaveLength(1);
    expect(near(played[0].end, 3.6)).toBe(true);
  });

  it("holds a long note through the microphone losing it for a moment", () => {
    const timeline = buildTimeline("C5/w", "4/4");
    const samples = hear(4, { midi: 72, from: 0, to: 3.8 }).map((s) => {
      // Drop-outs of a tenth and a sixth of a second, and a spell of noise between.
      const lost = (s.at >= 1 && s.at < 1.2) || (s.at >= 2.5 && s.at < 2.8);
      const noise = s.at >= 2 && s.at < 2.2;
      if (lost) return { ...s, hz: 0, clarity: 0.3, level: 0.001 };
      if (noise) return { ...s, hz: 440 * (1 + ((s.at * 37) % 1)), clarity: 0.85 };
      return s;
    });
    const played = transcribe(samples, timeline, SPQ);
    expect(played).toHaveLength(1);
    expect(near(played[0].start, 0) && near(played[0].end, 3.8)).toBe(true);
  });

  it("holds a note that wavers or sits out of tune", () => {
    const timeline = buildTimeline("C5/w", "4/4");
    const samples = hear(4, { midi: 72, from: 0, to: 3.8 }).map((s) =>
      s.hz ? { ...s, hz: s.hz * 2 ** ((0.4 + 0.25 * Math.sin(s.at * 8)) / 12) } : s,
    );
    expect(transcribe(samples, timeline, SPQ).map((p) => p.midi)).toEqual([72]);
  });

  it("ends a note at a breath, even before the same note again", () => {
    const timeline = buildTimeline("C5/w", "4/4");
    const played = transcribe(
      hear(4, { midi: 72, from: 0, to: 1.5 }, { midi: 72, from: 2, to: 3.8 }),
      timeline,
      SPQ,
    );
    expect(played).toHaveLength(2);
    expect(near(played[0].end, 1.5) && near(played[1].start, 2)).toBe(true);
  });

  it("takes a note heard at a fraction of its pitch up to it", () => {
    const timeline = buildTimeline("F5/w", "4/4");
    const low = hear(4, { midi: 77, from: 0, to: 3.6 }).map((s) => ({ ...s, hz: s.hz / 6 }));
    expect(transcribe(low, timeline, SPQ).map((p) => p.midi)).toEqual([77]);
  });
});

describe("toGhost", () => {
  it("snaps the start to a sixteenth and the length to the nearest note value", () => {
    expect(toGhost({ start: 2.07, end: 2.97, midi: 72 })).toEqual({
      start: 2,
      length: 1,
      midi: 72,
    });
    expect(toGhost({ start: 0, end: 1.4, midi: 72 }).length).toBe(1.5);
    expect(toGhost({ start: 0, end: 0.3, midi: 72 }).length).toBe(0.25);
    expect(toGhost({ start: 0, end: 2.8, midi: 72 }).length).toBe(3);
    expect(toGhost({ start: 0, end: 7, midi: 72 }).length).toBe(4);
  });
});

describe("wrongNotes", () => {
  it("gives a ghost for each note played that isn't the one written there", () => {
    const timeline = buildTimeline("C5/q, D5, E5/h", "4/4");
    const played = transcribe(
      hear(
        4,
        { midi: 72, from: 0, to: 0.9 },
        { midi: 71, from: 1, to: 1.5 },
        { midi: 76, from: 2, to: 3.8 },
      ),
      timeline,
      SPQ,
    );
    expect(wrongNotes(played, timeline)).toEqual([{ start: 1, length: 0.5, midi: 71 }]);
  });

  it("gives a ghost for a note played over a rest", () => {
    const timeline = buildTimeline("C5/h, B4/h/r", "4/4");
    const played = transcribe(
      hear(4, { midi: 72, from: 0, to: 1.8 }, { midi: 67, from: 2.5, to: 3.5 }),
      timeline,
      SPQ,
    );
    expect(wrongNotes(played, timeline)).toEqual([{ start: 2.5, length: 1, midi: 67 }]);
  });
});

describe("restartPoint", () => {
  const timeline = buildTimeline("C5/q, D5, (E5, F5)", "4/4");
  const sounds = [
    { midi: 72, from: 0, to: 0.9 },
    { midi: 74, from: 1, to: 1.9 },
    { midi: 76, from: 2, to: 3 }, // slurred into the F5, no gap
    { midi: 77, from: 3, to: 3.5 },
  ];

  it("is the note before the last while the last may carry on, then the last after a silence", () => {
    const samples = hear(4, ...sounds);
    const played = transcribe(samples, timeline, SPQ);
    // Just after the F5 stops, it could still carry on: the E5 before it is over.
    expect(restartPoint(played, 3.6, SPQ)).toBe(2);
    // More than 0.2 s (0.4 quarters) of silence after it: the F5 is over too.
    expect(restartPoint(played, 3.95, SPQ)).toBe(3);
    expect(restartPoint([], 4, SPQ)).toBe(-1);
  });

  it("is where transcription can start again, giving the same notes from there", () => {
    const samples = hear(4, ...sounds);
    const played = transcribe(samples, timeline, SPQ);
    const at = restartPoint(played, 3.6, SPQ);
    expect(transcribe(samples, timeline, SPQ, played[at].start)).toEqual(played.slice(at));
  });
});

describe("forTempo", () => {
  it("keeps a length as it is at slow tempos, a share of a sixteenth at fast ones, over a floor", () => {
    // ♩ = 60: a sixteenth is 0.25 s, so the length itself is shorter.
    expect(forTempo(0.08, 1)).toBe(0.08);
    // ♩ = 208: 0.6 of a 0.072 s sixteenth.
    expect(forTempo(0.08, 60 / 208)).toBeCloseTo(0.0433, 3);
    // However fast, never under 0.03 s: a click is still a blip.
    expect(forTempo(0.08, 0.1)).toBe(0.03);
  });
});

describe("transcribe at a fast tempo", () => {
  const SPQ_208 = 60 / 208;

  it("keeps sixteenths, a wrong one among them", () => {
    const timeline = buildTimeline("C5/16, D5, E5, F5, G5/q, A5/h", "4/4");
    // Each sixteenth sounds 0.22 of a quarter: 0.063 s, under the 0.08 s kept at slow tempos.
    const played = transcribe(
      hear(
        4,
        { midi: 72, from: 0, to: 0.22 },
        { midi: 75, from: 0.25, to: 0.47 }, // E♭5 for D5
        { midi: 76, from: 0.5, to: 0.72 },
        { midi: 77, from: 0.75, to: 0.97 },
        { midi: 79, from: 1, to: 1.9 },
        { midi: 81, from: 2, to: 3.9 },
      ),
      timeline,
      SPQ_208,
    );
    expect(played.map((p) => p.midi)).toEqual([72, 75, 76, 77, 79, 81]);
    expect(wrongNotes(played, timeline).map((g) => g.midi)).toEqual([75]);
  });

  it("still drops a blip as short as the metronome's click", () => {
    const timeline = buildTimeline("C5/w", "4/4");
    // 0.02 s of G5 through the held C5, and 0.02 s of sound on its own after it.
    const blip = 0.02 / SPQ_208;
    const played = transcribe(
      hear(
        6,
        { midi: 72, from: 0, to: 3.9 },
        { midi: 79, from: 1, to: 1 + blip },
        { midi: 79, from: 5, to: 5 + blip },
      ),
      timeline,
      SPQ_208,
    );
    expect(played.map((p) => p.midi)).toEqual([72]);
  });
});
