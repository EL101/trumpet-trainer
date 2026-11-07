import { describe, expect, it } from "vitest";
import type { PitchSample } from "./hearing";
import { newLiveScore, rewindLive, updateLive } from "./liveScore";
import { heardUntil, scoreRun } from "./scoring";
import { buildTimeline, soundingNotes, type Timeline } from "./timeline";
import { transcribe, wrongNotes } from "./transcribe";
import { CONCERT_OFFSET } from "./tuning";

/** Frames a quarter note: 60 a second at ♩ = 120. */
const FRAMES_PER_QUARTER = 30;
/** 4/4 at ♩ = 120. */
const TIMING = { beat: 1, secondsPerQuarter: 0.5 };
/** How far the music heard runs ahead of the newest frame: the frame's and microphone's delays. */
const DELAY = 0.1;

type Sound = { midi: number; from: number; to: number; cents?: number };

/** What the microphone hears from `sounds` (written pitches) from `start` to `end`. */
function hear(start: number, end: number, ...sounds: Sound[]): PitchSample[] {
  const samples: PitchSample[] = [];
  for (let f = Math.ceil(start * FRAMES_PER_QUARTER); f < end * FRAMES_PER_QUARTER; f++) {
    const at = f / FRAMES_PER_QUARTER;
    const sound = sounds.findLast((s) => s.from <= at && at < s.to);
    if (!sound) {
      samples.push({ at, hz: 0, clarity: 0.2, level: 0.001 });
      continue;
    }
    const concert = sound.midi + CONCERT_OFFSET + (sound.cents ?? 0) / 100;
    samples.push({ at, hz: 440 * 2 ** ((concert - 69) / 12), clarity: 0.97, level: 0.2 });
  }
  return samples;
}

// Two bars: wrong notes, an out-of-tune note, a slur with no gap, a tie and a dropout.
const NOTES = "C5/q, D5, E5/h, (F5/8, G5, A5/q), B5/h~, B5/q";
const SOUNDS: Sound[] = [
  { midi: 72, from: 0, to: 0.9 },
  { midi: 75, from: 1, to: 1.9 }, // D5 written, E♭5 played
  { midi: 76, from: 2, to: 3.2, cents: 28 },
  { midi: 76, from: 3.3, to: 3.85, cents: 28 }, // a dropout through the half note
  { midi: 77, from: 4, to: 4.5 },
  { midi: 79, from: 4.5, to: 5 },
  { midi: 81, from: 5, to: 6 }, // slurred, no gap
  { midi: 83, from: 6, to: 8.8 }, // tied over the bar line
  { midi: 79, from: 8.8, to: 9 }, // a wrong note to end
];
const END = 9.5;

/** The marks working over every sample would give, with the music heard up to `now`. */
function fullMarks(timeline: Timeline, samples: PitchSample[], now: number) {
  const ghosts = wrongNotes(transcribe(samples, timeline, TIMING.secondsPerQuarter), timeline);
  const cents = scoreRun(timeline, samples, TIMING).cents.map((c, i) => {
    const note = timeline.notes[i];
    return note.start + note.length <= now ? c : null;
  });
  return { ghosts, cents };
}

/**
 * Feeds `samples` to `live` an update's worth at a time, checking each against
 * `fullMarks`. A take resumed at `from` starts with everything heard before it.
 */
function playThrough(
  live: ReturnType<typeof newLiveScore>,
  timeline: Timeline,
  samples: PitchSample[],
  from = 0,
) {
  const first = samples.findIndex((s) => s.at >= from);
  // An update every 150 ms at ♩ = 120: 9 frames.
  for (let n = first; n <= samples.length; n += 9) {
    const sofar = samples.slice(0, n);
    const now = Math.max(from, sofar.at(-1)?.at ?? 0) + DELAY;
    const marks = updateLive(live, sofar, timeline, TIMING, now);
    expect(marks).toEqual(fullMarks(timeline, sofar, now));
  }
}

describe("updateLive", () => {
  it("gives the same marks, update by update, as working over every sample", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    playThrough(newLiveScore(), timeline, hear(0, END, ...SOUNDS));
  });

  it("keeps the notes that are over, and transcribes from the latest one", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const live = newLiveScore();
    playThrough(live, timeline, hear(0, END, ...SOUNDS));

    // Everything before the tied B5 (from beat 6) is final, and not transcribed again.
    expect(live.kept.length).toBeGreaterThanOrEqual(5);
    expect(live.restartAt).toBeGreaterThanOrEqual(6);
  });

  it("locks a note's results in only once all of its stretch is heard", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const samples = hear(0, END, ...SOUNDS);
    const live = newLiveScore();
    // The E5 half note (written note 2) is heard until half a beat past its end.
    const until = heardUntil(soundingNotes(timeline)[2], TIMING.beat);

    const upTo = (at: number) => samples.filter((s) => s.at <= at);
    updateLive(live, upTo(until - 0.1), timeline, TIMING, until);
    expect(live.locked.has(2)).toBe(false);
    updateLive(live, upTo(until), timeline, TIMING, until + DELAY);
    expect(live.locked.get(2)).toBe(28);
  });

  it("gives the same marks as an unchanged update, so the staff isn't redrawn", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const samples = hear(0, 3, ...SOUNDS);
    const live = newLiveScore();
    const first = updateLive(live, samples, timeline, TIMING, 3);
    const again = updateLive(live, samples, timeline, TIMING, 3);
    expect(again.ghosts).toBe(first.ghosts);
    expect(again.cents).toBe(first.cents);
  });
});

describe("rewindLive", () => {
  it("throws away what was kept from a resumed take's start, and works it out again", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const live = newLiveScore();
    // The first take plays to the end, with wrong notes in the second bar.
    playThrough(live, timeline, hear(0, END, ...SOUNDS));

    // Resumed at bar 2: the recorder keeps only what came before it, and the new take
    // plays the second bar as written.
    const from = 4;
    const kept = hear(0, from, ...SOUNDS);
    const retake = hear(
      from,
      END,
      ...[
        { midi: 77, from: 4, to: 4.45 },
        { midi: 79, from: 4.5, to: 4.95 },
        { midi: 81, from: 5, to: 5.9 },
        { midi: 83, from: 6, to: 8.8 },
        { midi: 83, from: 9, to: 9.9 },
      ],
    );
    rewindLive(live, from, timeline, TIMING.beat);
    expect(live.kept.every((note) => note.end < from)).toBe(true);
    expect(live.restartAt).toBeLessThan(from);
    expect(
      [...live.locked.keys()].every((k) => heardUntil(soundingNotes(timeline)[k], 1) <= from),
    ).toBe(true);

    // From there, update by update, it matches working over what the recorder has.
    playThrough(live, timeline, [...kept, ...retake], from);
    const final = updateLive(live, [...kept, ...retake], timeline, TIMING, 20);
    expect(final.ghosts.map((g) => g.midi)).toEqual([75]);
  });

  it("from the top, forgets everything", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const live = newLiveScore();
    playThrough(live, timeline, hear(0, END, ...SOUNDS));

    rewindLive(live, 0, timeline, TIMING.beat);
    expect(live).toMatchObject({ kept: [], keptGhosts: [], restartAt: 0 });
    expect(live.locked.size).toBe(0);
  });
});
