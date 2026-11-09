import { describe, expect, it } from "vitest";
import type { PitchSample } from "./hearing";
import { buildTimeline } from "./timeline";
import {
  beamRuns,
  forTempo,
  ghostPieces,
  heldTo,
  judgePlayed,
  silences,
  restartPoint,
  toGhost,
  toMark,
  transcribe,
  type PlayedNote,
} from "./transcribe";
import type { Timeline } from "./timeline";
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

/**
 * `samples` with a tongue stop too short for a silent frame at each of `at`: the level
 * dips to half over a frame or two, as a 25 ms stop does through a 43 ms frame.
 */
function tongued(samples: PitchSample[], ...at: number[]): PitchSample[] {
  return samples.map((s) => {
    const seconds = Math.min(...at.map((a) => Math.abs(s.at - a))) * SPQ;
    const share = seconds < 0.0125 ? 0.5 : seconds < 0.03 ? 0.8 : 1;
    return { ...s, level: s.level * share };
  });
}

/** The played notes judged wrong, as ghosts. */
const wrongNotes = (played: PlayedNote[], timeline: Timeline) =>
  played
    .map((p) => judgePlayed(p, timeline))
    .filter((j) => j.written === null)
    .map(({ start, length, midi }) => ({ start, length, midi }));

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

  it("hears tongued sixteenths as separate notes, though no frame between is silent", () => {
    const timeline = buildTimeline("C5/16, C5, C5, C5, C5/q, C5/h", "4/4");
    const onsets = [0.25, 0.5, 0.75, 1, 2];
    const played = transcribe(
      tongued(hear(4, { midi: 72, from: 0, to: 3.9 }), ...onsets),
      timeline,
      SPQ,
    );
    expect(played.map((p) => Math.round(p.start * 4) / 4)).toEqual([0, ...onsets]);
    expect(played.map((p) => toGhost(p).length)).toEqual([0.25, 0.25, 0.25, 0.25, 1, 2]);
  });

  it("hears a tongue stop as a repeat when its one silent frame is shorter than a drop-out", () => {
    // A 40 ms stop: one frame at the bottom of the dip hears nothing.
    const timeline = buildTimeline("C5/8, C5, C5/h.", "4/4");
    const samples = tongued(hear(4, { midi: 72, from: 0, to: 3.9 }), 0.5, 1).map((s) =>
      [15, 30].includes(Math.round(s.at * 30)) ? { ...s, hz: 0, clarity: 0.2, level: 0.001 } : s,
    );
    const played = transcribe(samples, timeline, SPQ);
    expect(played.map((p) => Math.round(p.start * 4) / 4)).toEqual([0, 0.5, 1]);
  });

  it("holds a note through a dip in level where no note is written", () => {
    const timeline = buildTimeline("C5/w", "4/4");
    const played = transcribe(tongued(hear(4, { midi: 72, from: 0, to: 3.8 }), 1.5), timeline, SPQ);
    expect(played).toHaveLength(1);
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
    expect(toGhost({ start: 0, end: 4.3, midi: 72 }).length).toBe(4);
  });

  it("keeps a note held past a whole note, to the nearest beat", () => {
    expect(toGhost({ start: 0, end: 5.8, midi: 72 }).length).toBe(6);
    expect(toGhost({ start: 1, end: 8.1, midi: 72 }).length).toBe(7);
  });
});

describe("heldTo", () => {
  const notes = [
    { start: 0.08, end: 0.7, midi: 72 },
    { start: 0.95, end: 1.6, midi: 74 }, // 0.125 s after the last: tongued
    { start: 2.5, end: 3, midi: 76 }, // 0.45 s after: a rest
  ];

  it("holds a note to the next one when the silence between is shorter than a rest", () => {
    expect(heldTo(notes, 0, SPQ)).toBe(0.95);
    expect(heldTo(notes, 1, SPQ)).toBeUndefined();
    expect(heldTo(notes, 2, SPQ)).toBeUndefined();
  });

  it("writes a note held on as reaching the next one's sixteenth, with no rest between", () => {
    // Heard for 0.62 beats, so a dotted eighth on its own, and a sixteenth rest after.
    expect(toGhost(notes[0]).length).toBe(0.75);
    expect(toGhost(notes[0], heldTo(notes, 0, SPQ))).toEqual({ start: 0, length: 1, midi: 72 });
    // A next note snapped onto its own start leaves it as it sounded.
    expect(toGhost({ start: 0, end: 0.1, midi: 72 }, 0.1).length).toBe(0.25);
  });
});

describe("beamRuns", () => {
  const timeline = buildTimeline("C5/w, C5/w", "4/4");
  const runs = (...pieces: [number, number][]) =>
    beamRuns(
      pieces.map(([start, length]) => ({ start, length })),
      timeline,
      [1],
    );

  it("beams eighths and sixteenths that follow on within a beat", () => {
    expect(runs([0, 0.5], [0.5, 0.5], [1, 0.25], [1.25, 0.25], [1.5, 0.5])).toEqual([
      [0, 1],
      [2, 3, 4],
    ]);
    expect(runs([0, 0.75], [0.75, 0.25])).toEqual([[0, 1]]);
  });

  it("breaks at a beat, a gap, a longer note and a note crossing the beat", () => {
    expect(runs([0.5, 0.5], [1, 0.5])).toEqual([]);
    expect(runs([0, 0.25], [0.5, 0.5])).toEqual([]);
    expect(runs([0, 0.5], [0.5, 1], [1.5, 0.5])).toEqual([]);
    expect(runs([0, 0.25], [0.25, 0.5], [0.75, 0.5])).toEqual([[0, 1]]);
  });

  it("beams by the meter's groups, and not past the music's end", () => {
    const eighths = Array.from({ length: 6 }, (_, i): [number, number] => [i / 2, 0.5]);
    expect(
      beamRuns(
        eighths.map(([start, length]) => ({ start, length })),
        buildTimeline("C5/h., C5/h.", "6/8"),
        [1.5],
      ),
    ).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
    expect(runs([7.5, 0.5], [8, 0.5])).toEqual([]);
  });
});

describe("ghostPieces", () => {
  const timeline = buildTimeline("C5/w, C5/w, C5/w", "4/4");
  const pieces = (start: number, length: number) =>
    ghostPieces({ start, length, midi: 74 }, timeline).map(({ start, length, tied }) => [
      start,
      length,
      tied,
    ]);

  it("leaves a ghost within a bar as one note", () => {
    expect(pieces(1, 1.5)).toEqual([[1, 1.5, false]]);
    expect(pieces(0, 4)).toEqual([[0, 4, false]]);
  });

  it("ties a ghost across the barline", () => {
    // Held six beats from beat 3: a half, tied to a whole note.
    expect(pieces(2, 6)).toEqual([
      [2, 2, true],
      [4, 4, false],
    ]);
    expect(pieces(3.5, 1)).toEqual([
      [3.5, 0.5, true],
      [4, 0.5, false],
    ]);
  });

  it("ties a length no one note value fits", () => {
    expect(pieces(0, 2.5)).toEqual([
      [0, 2, true],
      [2, 0.5, false],
    ]);
    expect(pieces(1, 9)).toEqual([
      [1, 3, true],
      [4, 4, true],
      [8, 2, false],
    ]);
  });

  it("stops where the music ends", () => {
    expect(pieces(10, 4)).toEqual([[10, 2, false]]);
    // Starting there or after, it's one note at the end, as long as fits.
    expect(pieces(12, 6)).toEqual([[12, 4, false]]);
  });
});

describe("silences", () => {
  const timeline = buildTimeline("C5/w, C5/w, C5/w", "4/4");
  const note = (start: number, length: number) => ({ start, length, midi: 72 });
  const rests = (played: ReturnType<typeof note>[], to: number) =>
    silences(played, timeline, to).map(({ start, length, wholeBar }) =>
      wholeBar ? [start, "bar"] : [start, length],
    );

  it("writes the silence before, between and after the notes as rests", () => {
    expect(rests([note(1, 1), note(3, 1)], 5)).toEqual([
      [0, 1],
      [2, 1],
      [4, 1],
    ]);
  });

  it("writes rests on the beat: two quarters from beat 2, a half from beat 3", () => {
    expect(rests([note(0, 0.5)], 4)).toEqual([
      [0.5, 0.5],
      [1, 1],
      [2, 2],
    ]);
  });

  it("writes a whole bar of silence as one rest, and splits at barlines", () => {
    expect(rests([note(0, 3), note(9, 1)], 12)).toEqual([
      [3, 1],
      [4, "bar"],
      [8, 1],
      [10, 2],
    ]);
  });

  it("stops at `to`, and at the music's end, and skips overlaps and gaps under a sixteenth", () => {
    expect(rests([note(0, 1.5), note(1.25, 1)], 2.5)).toEqual([[2.25, 0.25]]);
    expect(rests([note(0, 11)], 20)).toEqual([[11, 1]]);
    expect(rests([], 0.1)).toEqual([]);
  });
});

describe("judgePlayed and toMark", () => {
  it("finds the written note a right one was, for its intonation", () => {
    const timeline = buildTimeline("C5/q, D5, E5/h", "4/4");
    const judged = judgePlayed({ start: 1.05, end: 2, midi: 74 }, timeline);
    expect(judged.written).toBe(1);
    expect(toMark(judged, [null, -12, null])).toEqual({
      start: 1,
      length: 1,
      midi: 74,
      status: "right",
      cents: -12,
    });
  });

  it("marks a wrong note, and one still sounding, without cents", () => {
    const timeline = buildTimeline("C5/q, D5, E5/h", "4/4");
    const wrong = judgePlayed({ start: 1, end: 1.9, midi: 75 }, timeline);
    expect(toMark(wrong, [null, 4, null])).toMatchObject({ status: "wrong", cents: null });
    const right = judgePlayed({ start: 2, end: 2.5, midi: 76 }, timeline);
    expect(toMark(right, [null, null, 8], true)).toMatchObject({
      status: "sounding",
      cents: null,
    });
  });

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
  it("keeps a length as it is at slow tempos, a share of the shortest note at fast ones, over a floor", () => {
    // ♩ = 60: a sixteenth is 0.25 s, so the length itself is shorter.
    expect(forTempo(0.08, 1, 0.25)).toBe(0.08);
    // ♩ = 208: 0.6 of a 0.072 s sixteenth.
    expect(forTempo(0.08, 60 / 208, 0.25)).toBeCloseTo(0.0433, 3);
    // However fast, never under 0.03 s: a click is still a blip.
    expect(forTempo(0.08, 0.1, 0.25)).toBe(0.03);
  });

  it("goes only as short as the shortest note written", () => {
    // ♩ = 152 with eighths at the shortest: 0.6 of a 0.197 s eighth is longer, so as it was.
    expect(forTempo(0.08, 60 / 152, 0.5)).toBe(0.08);
    // No notes at all: as it was.
    expect(forTempo(0.08, 60 / 152, Infinity)).toBe(0.08);
  });
});

describe("transcribe at a fast tempo", () => {
  const SPQ_208 = 60 / 208;

  it("drops a split attack in music with no sixteenths", () => {
    // ♩ = 152, eighths: each attack speaks a fourth up for 0.075 s (0.19 of a quarter)
    // before it settles. As long as that, they'd be kept as notes if fast sixteenths were
    // allowed for, and be wrong notes on every attack.
    const SPQ_152 = 60 / 152;
    const timeline = buildTimeline("C5/8, D5, E5, F5, G5/h", "4/4");
    const attack = (midi: number, from: number, to: number) => [
      { midi: midi + 5, from, to: from + 0.19 },
      { midi, from: from + 0.19, to },
    ];
    const played = transcribe(
      hear(
        4,
        ...attack(72, 0, 0.45),
        ...attack(74, 0.5, 0.95),
        ...attack(76, 1, 1.45),
        ...attack(77, 1.5, 1.95),
        ...attack(79, 2, 3.9),
      ),
      timeline,
      SPQ_152,
    );
    expect(played.map((p) => p.midi)).toEqual([72, 74, 76, 77, 79]);
    expect(wrongNotes(played, timeline)).toEqual([]);
  });

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
