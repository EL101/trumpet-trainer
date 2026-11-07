import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";
import {
  AT_TOP,
  barNow,
  followMusic,
  pauseAt,
  seekTo,
  startPlaying,
  type Transport,
} from "./transport";

// Two bars of 4/4: bar 0 runs 0–4, bar 1 runs 4–8.
const timeline = buildTimeline("C4/q, D4, E4, F4, G4, A4, B4, C5", "4/4");

describe("startPlaying", () => {
  it("counts in a bar before the top", () => {
    expect(startPlaying(AT_TOP, timeline, true)).toEqual({
      status: "countIn",
      position: -4,
      from: 0,
    });
  });

  it("starts straight away without a count-in", () => {
    expect(startPlaying(AT_TOP, timeline, false)).toEqual({
      status: "playing",
      position: 0,
      from: 0,
    });
  });

  it("counts in before wherever it's to pick up", () => {
    const paused: Transport = { status: "paused", position: 5.5, from: 4 };
    expect(startPlaying(paused, timeline, true)).toMatchObject({ position: 0, from: 4 });
  });
});

describe("followMusic", () => {
  const countingIn: Transport = { status: "countIn", position: -4, from: 0 };

  it("is counting in until the music starts, then playing", () => {
    expect(followMusic(countingIn, timeline, -1)).toMatchObject({
      status: "countIn",
      position: -1,
    });
    expect(followMusic(countingIn, timeline, 0)).toMatchObject({ status: "playing", position: 0 });
  });

  it("finishes at the end, and doesn't run past it", () => {
    const playing: Transport = { status: "playing", position: 7.9, from: 0 };
    expect(followMusic(playing, timeline, 8.2)).toEqual({
      status: "finished",
      position: 8,
      from: 0,
    });
  });
});

describe("pauseAt", () => {
  it("leaves the cursor where it stopped, to resume from the top of its bar", () => {
    const playing: Transport = { status: "playing", position: 5.5, from: 0 };
    expect(pauseAt(playing, timeline, 5.6)).toEqual({ status: "paused", position: 5.6, from: 4 });
  });

  it("moves the cursor back to the top of its bar when asked, as a scored take does", () => {
    const playing: Transport = { status: "playing", position: 5.5, from: 0 };
    expect(pauseAt(playing, timeline, 5.6, { toBar: true })).toEqual({
      status: "paused",
      position: 4,
      from: 4,
    });
  });

  it("resumes from a barline it's paused right on", () => {
    const playing: Transport = { status: "playing", position: 4, from: 0 };
    // A rounding error short of the barline still counts as on it.
    expect(pauseAt(playing, timeline, 4 - 1e-12).from).toBe(4);
  });

  it("waits where it would have started when paused in the count-in", () => {
    const countingIn: Transport = { status: "countIn", position: 2.5, from: 4 };
    expect(pauseAt(countingIn, timeline, 2.5)).toEqual({ status: "paused", position: 4, from: 4 });
  });
});

describe("seekTo", () => {
  it("carries straight on from the new place while playing", () => {
    const playing: Transport = { status: "playing", position: 1, from: 0 };
    expect(seekTo(playing, timeline, 6)).toEqual({ status: "playing", position: 6, from: 6 });
  });

  it("counts in again for the new place while counting in", () => {
    const countingIn: Transport = { status: "countIn", position: -2, from: 0 };
    expect(seekTo(countingIn, timeline, 6)).toEqual({ status: "countIn", position: 2, from: 6 });
  });

  it("gets ready to play from the new place otherwise", () => {
    for (const status of ["ready", "paused", "finished"] as const) {
      expect(seekTo({ status, position: 8, from: 4 }, timeline, 2), status).toEqual({
        status: "ready",
        position: 2,
        from: 2,
      });
    }
  });
});

describe("barNow", () => {
  it("is the bar being heard while the music plays", () => {
    expect(barNow({ status: "playing", position: 5.5, from: 0 }, timeline)).toBe(1);
  });

  it("is the bar Play starts in otherwise, even mid count-in", () => {
    expect(barNow(AT_TOP, timeline)).toBe(0);
    expect(barNow({ status: "paused", position: 5.5, from: 4 }, timeline)).toBe(1);
    expect(barNow({ status: "countIn", position: 1, from: 4 }, timeline)).toBe(1);
  });

  it("is the last bar once it's finished", () => {
    expect(barNow({ status: "finished", position: 8, from: 0 }, timeline)).toBe(1);
  });
});
