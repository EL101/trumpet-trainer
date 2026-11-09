import { describe, expect, it } from "vitest";
import type { PitchSample } from "./hearing";
import { newLiveScore, rewindLive, updateLive } from "./liveScore";
import { heardUntil, scoreRun } from "./scoring";
import { buildTimeline, soundingNotes, type Timeline } from "./timeline";
import {
  BRIDGE_SECONDS,
  heldTo,
  judgePlayed,
  restartPoint,
  toMark,
  transcribe,
} from "./transcribe";
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
  const transcribed = transcribe(samples, timeline, TIMING.secondsPerQuarter);
  const cents = scoreRun(timeline, samples, TIMING).cents.map((c, i) => {
    const note = timeline.notes[i];
    return note.start + note.length <= now ? c : null;
  });
  // The last note is still sounding, so not judged, until it's over.
  const heardTo = samples.at(-1)?.at ?? -Infinity;
  const last = transcribed.length - 1;
  const sounding =
    last >= 0 && restartPoint(transcribed, heardTo, TIMING.secondsPerQuarter) !== last;
  const played = transcribed.map((p, i) =>
    toMark(
      judgePlayed(p, timeline, heldTo(transcribed, i, TIMING.secondsPerQuarter)),
      cents,
      sounding && i === last,
    ),
  );
  // Nothing after a note still sounding is silence.
  const silentTo = sounding
    ? played[last].start
    : heardTo - BRIDGE_SECONDS / TIMING.secondsPerQuarter;
  return { played, cents, restsTo: Math.max(0, Math.floor(silentTo * 4) / 4) };
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

  it("splits tongued sixteenths with no silent frame between the same, update by update", () => {
    const timeline = buildTimeline("C5/16, C5, C5, C5, C5/q, C5/h, D5/w", "4/4");
    const onsets = [0.25, 0.5, 0.75, 1, 2];
    // One unbroken C5, the level dipping to half at each tongue stop.
    const samples = hear(0, 8, { midi: 72, from: 0, to: 3.95 }, { midi: 74, from: 4, to: 7.5 }).map(
      (s) => {
        const seconds =
          Math.min(...onsets.map((a) => Math.abs(s.at - a))) * TIMING.secondsPerQuarter;
        return { ...s, level: s.level * (seconds < 0.0125 ? 0.5 : seconds < 0.03 ? 0.8 : 1) };
      },
    );
    const live = newLiveScore();
    playThrough(live, timeline, samples);
    const final = updateLive(live, samples, timeline, TIMING, 20);
    expect(final.played.map((m) => [m.start, m.status])).toEqual([
      ...[0, ...onsets].map((start) => [start, "right"]),
      [4, "right"],
    ]);
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

  it("doesn't judge a note until it's over, so one played early isn't drawn and taken off", () => {
    // Each note comes in a third of a beat early: while it's held, its middle is still in
    // the note before.
    const timeline = buildTimeline("C5/q, D5, E5, F5", "4/4");
    const samples = hear(
      0,
      4,
      { midi: 72, from: 0, to: 0.6 },
      { midi: 74, from: 0.66, to: 1.6 },
      { midi: 76, from: 1.66, to: 2.9 },
      { midi: 77, from: 3, to: 3.9 },
    );
    const live = newLiveScore();
    for (let n = 0; n <= samples.length; n += 9) {
      const sofar = samples.slice(0, n);
      const now = (sofar.at(-1)?.at ?? 0) + DELAY;
      const { played } = updateLive(live, sofar, timeline, TIMING, now);
      expect(played.filter((m) => m.status === "wrong")).toEqual([]);
    }
  });

  it("writes no rest after a note while it's still held", () => {
    // ♩ = 60: a held note's ghost is rounded to a note value, which can fall short of
    // where it's been heard to (at 3.45 beats, a dotted half).
    const slow = { beat: 1, secondsPerQuarter: 1 };
    const timeline = buildTimeline("C5/w, C5/w", "4/4");
    const samples = hear(0, 6, { midi: 72, from: 0, to: 6 }).filter((s) => s.at <= 3.45);
    const marks = updateLive(newLiveScore(), samples, timeline, slow, 3.5);
    expect(marks.played).toMatchObject([{ start: 0, length: 3, status: "sounding" }]);
    expect(marks.restsTo).toBe(0);
  });

  it("gives the same marks as an unchanged update, so the staff isn't redrawn", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const samples = hear(0, 3, ...SOUNDS);
    const live = newLiveScore();
    const first = updateLive(live, samples, timeline, TIMING, 3);
    const again = updateLive(live, samples, timeline, TIMING, 3);
    expect(again.played).toBe(first.played);
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
    expect(final.played.filter((m) => m.status === "wrong").map((m) => m.midi)).toEqual([75]);
  });

  it("from the top, forgets everything", () => {
    const timeline = buildTimeline(NOTES, "4/4");
    const live = newLiveScore();
    playThrough(live, timeline, hear(0, END, ...SOUNDS));

    rewindLive(live, 0, timeline, TIMING.beat);
    expect(live).toMatchObject({ kept: [], keptJudged: [], restartAt: 0 });
    expect(live.locked.size).toBe(0);
  });
});
