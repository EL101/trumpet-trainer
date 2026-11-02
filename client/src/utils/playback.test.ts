import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { pulseOf } from "@/lib/meter";
import { buildTimeline } from "@/lib/timeline";
import { scheduleClick } from "./click";
import { Playback, type PlaybackSettings } from "./playback";
import type { Trumpet } from "./trumpet";

vi.mock("./click", () => ({ scheduleClick: vi.fn() }));

/** An audio context whose clock only moves when a test moves it. */
function fakeContext() {
  const gains: {
    gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const ctx = {
    currentTime: 0,
    outputLatency: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    createGain() {
      const gain = {
        gain: { value: 1, setTargetAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    },
  };
  return { ctx, gains };
}

const SETTINGS: PlaybackSettings = { tempo: 60, notes: true, click: true, subdivision: 1 };

let ctx: ReturnType<typeof fakeContext>["ctx"];
let gains: ReturnType<typeof fakeContext>["gains"];
let trumpet: { play: Mock<Trumpet["play"]> };

/** A Playback of `notes`, at 60 beats a minute unless `settings` say otherwise. */
function playback(notes: string, timeSig = "4/4", settings: Partial<PlaybackSettings> = {}) {
  const p = new Playback(
    ctx as unknown as AudioContext,
    buildTimeline(notes, timeSig),
    pulseOf(timeSig),
  );
  p.setTrumpet(trumpet);
  p.update({ ...SETTINGS, ...settings });
  return p;
}

/** Lets `seconds` pass on the audio clock, with the scheduler ticking as it goes. */
function run(seconds: number) {
  for (let step = Math.round(seconds / 0.025); step > 0; step--) {
    ctx.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;
/** The clicks scheduled so far, as [time, accented]. */
const clicks = () =>
  vi.mocked(scheduleClick).mock.calls.map(([when, accent]) => [round(when), accent]);
/** The notes played so far, as [concert MIDI, time, seconds]. */
const notes = () =>
  trumpet.play.mock.calls.map(([midi, when, duration]) => [midi, round(when), round(duration)]);

beforeEach(() => {
  vi.useFakeTimers();
  // The scheduler's timers are window's; in tests, window is the global the fakes replace.
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("document", { hidden: false });
  ({ ctx, gains } = fakeContext());
  trumpet = { play: vi.fn<Trumpet["play"]>() };
  vi.mocked(scheduleClick).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Playback", () => {
  it("counts in a bar, accenting its downbeat, then clicks each beat to the end", () => {
    playback("C4/w, D4/w").start(0);
    run(13);
    // The run starts 0.05s after Play; a beat is a second at 60.
    expect(clicks()).toEqual([
      [0.05, true],
      [1.05, false],
      [2.05, false],
      [3.05, false],
      [4.05, true],
      [5.05, false],
      [6.05, false],
      [7.05, false],
      [8.05, true],
      [9.05, false],
      [10.05, false],
      [11.05, false],
    ]);
  });

  it("plays the notes after the count-in, a whole tone down, tongued apart", () => {
    playback("C4/w, D4/w").start(0);
    run(13);
    // Written C4 (60) sounds B♭3 (58); a whole note at 60 lasts 4s, held for 90% of it.
    expect(notes()).toEqual([
      [58, 4.05, 3.6],
      [60, 8.05, 3.6],
    ]);
  });

  it("starts straight away without a count-in", () => {
    playback("C4/w").start(0, { countIn: false });
    run(1);
    expect(clicks()[0]).toEqual([0.05, true]);
    expect(notes()[0]).toEqual([58, 0.05, 3.6]);
  });

  it("holds slurred notes for their full length and plays tied notes as one", () => {
    playback("(C4/q, D4/q), E4/h~, E4/w").start(0, { countIn: false });
    run(9);
    expect(notes()).toEqual([
      [58, 0.05, 1],
      [60, 1.05, 0.9],
      // A half note tied to a whole note: six beats, tongued off at the end.
      [62, 2.05, 5.4],
    ]);
  });

  it("counts in even with the click off, and is quiet after", () => {
    playback("C4/w", "4/4", { click: false }).start(0);
    run(9);
    expect(clicks().map(([when]) => when)).toEqual([0.05, 1.05, 2.05, 3.05]);
  });

  it("subdivides the music's beats but not the count-in's", () => {
    playback("C4/w", "4/4", { subdivision: 2 }).start(0);
    run(9);
    expect(clicks().map(([when]) => when)).toEqual([
      0.05, 1.05, 2.05, 3.05, 4.05, 4.55, 5.05, 5.55, 6.05, 6.55, 7.05, 7.55,
    ]);
  });

  it("counts 6/8 in dotted quarters, at the tempo of the dotted quarter", () => {
    playback("C4/q., D4/q.", "6/8").start(0);
    run(5);
    expect(clicks()).toEqual([
      [0.05, true],
      [1.05, false],
      [2.05, true],
      [3.05, false],
    ]);
    // A dotted quarter lasts a second; held for 90% of it.
    expect(notes()).toEqual([
      [58, 2.05, 0.9],
      [60, 3.05, 0.9],
    ]);
  });

  it("picks up partway through, skipping the notes before it", () => {
    playback("C4/w, D4/w").start(4, { countIn: false });
    run(5);
    expect(notes()).toEqual([[60, 0.05, 3.6]]);
  });

  it("picks up a note tied over the bar line it starts at, for the rest of its length", () => {
    playback("C4/h, D4/h~, D4/h, E4/h").start(4, { countIn: false });
    run(5);
    expect(notes()).toEqual([
      // The tied D's last two beats, tongued off where it would have been.
      [60, 0.05, 1.6],
      [62, 2.05, 1.8],
    ]);
  });

  it("holds a note tied over the bar line back until its count-in is over", () => {
    playback("C4/h, D4/h~, D4/h, E4/h").start(4);
    run(1);
    expect(notes()).toEqual([]);
    run(4);
    expect(notes()[0]).toEqual([60, 4.05, 1.6]);
  });

  it("counts in on the beat when it picks up off the beat", () => {
    playback("C4/q, D4/q, E4/8, F4/8, G4/q").start(2.5);
    run(5);
    // From 2.5 the count-in runs from -1.5: its beats fall at -1, 0, 1 and 2.
    expect(clicks().slice(0, 4)).toEqual([
      [0.55, false],
      [1.55, true],
      [2.55, false],
      [3.55, false],
    ]);
    expect(notes()[0]).toEqual([63, 4.05, 0.45]);
  });

  it("carries on from where the music is when the tempo changes", () => {
    const p = playback("C4/q, D4, E4, F4, G4, A4, B4, C5");
    p.start(0, { countIn: false });
    run(2);
    p.update({ ...SETTINGS, tempo: 120 });
    run(3);
    const times = notes().map(([, when]) => when);
    // Beats 0–2 were already handed over at 60; from 2s in, beats come every half second.
    expect(times.slice(0, 3)).toEqual([0.05, 1.05, 2.05]);
    expect(times.slice(3, 6)).toEqual([2.525, 3.025, 3.525]);
  });

  it("reports where the music is as it's heard", () => {
    const p = playback("C4/w");
    expect(p.position()).toBeNull();
    p.start(0);
    // Before the first click, it's at the start of the count-in.
    expect(p.position()).toBe(-4);
    ctx.currentTime = 2.05;
    expect(p.position()).toBeCloseTo(-2);
    // What's playing now reaches the ears a little later.
    ctx.outputLatency = 0.5;
    expect(p.position()).toBeCloseTo(-2.5);
  });

  it("stops scheduling and fades everything out when stopped", () => {
    const p = playback("C4/q, D4, E4, F4");
    p.start(0, { countIn: false });
    run(1);
    const before = clicks().length;
    p.stop();
    expect(p.position()).toBeNull();
    const [noteBus, clickBus] = gains.slice(-2);
    expect(noteBus.gain.setTargetAtTime).toHaveBeenCalledWith(0, ctx.currentTime, 0.015);
    expect(clickBus.gain.setTargetAtTime).toHaveBeenCalledWith(0, ctx.currentTime, 0.015);
    run(3);
    expect(clicks()).toHaveLength(before);
    expect(noteBus.disconnect).toHaveBeenCalled();
    expect(clickBus.disconnect).toHaveBeenCalled();
  });

  it("starts each run fresh, stopping the one before", () => {
    const p = playback("C4/q, D4, E4, F4");
    p.start(0, { countIn: false });
    const [firstNotes] = gains.slice(-2);
    p.start(2, { countIn: false });
    expect(firstNotes.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), 0.015);
    run(3);
    expect(notes().map(([midi]) => midi)).toEqual([58, 62, 63]);
  });

  it("mutes the notes when they're turned off, and starts muted when they're off", () => {
    const p = playback("C4/w");
    p.start(0);
    const [noteBus] = gains.slice(-2);
    p.update({ ...SETTINGS, notes: false });
    expect(noteBus.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, ctx.currentTime, 0.01);

    p.start(0);
    expect(gains.at(-2)!.gain.value).toBe(0);
  });

  it("plays only the clicks until the trumpet arrives", () => {
    const p = new Playback(
      ctx as unknown as AudioContext,
      buildTimeline("C4/q, D4, E4, F4", "4/4"),
      pulseOf("4/4"),
    );
    p.update(SETTINGS);
    p.start(0, { countIn: false });
    run(1.5);
    expect(clicks().length).toBeGreaterThan(0);
    p.setTrumpet(trumpet);
    run(3);
    // The notes already due went by without it; the rest play.
    expect(notes().map(([midi]) => midi)).toEqual([62, 63]);
  });

  it("looks further ahead in a background tab, whose timers run slowly", () => {
    vi.stubGlobal("document", { hidden: true });
    playback("C4/w").start(0);
    expect(clicks().map(([when]) => when)).toEqual([0.05, 1.05]);
  });

  it("asks the audio context to resume, since browsers start it suspended", () => {
    playback("C4/w").start(0);
    expect(ctx.resume).toHaveBeenCalled();
  });
});
