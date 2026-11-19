import { describe, expect, it } from "vitest";
import { demoAt, demoPeriod, valvesFor } from "./landingDemo";
import { buildTimeline } from "./timeline";

// Two bars of quarters at a beat a second: each run is 1s of lead, 8s of music, 2s held.
const timeline = buildTimeline("C4/q, D4/q, E4/q, F4/q, G4/q, B4/q/r, B4/q, C5/q", "4/4");
const pacing = { bpm: 60, lead: 1, hold: 2 };

describe("demoPeriod", () => {
  it("adds the lead, the music at the tempo and the hold", () => {
    expect(demoPeriod(timeline, pacing)).toBe(11);
  });
});

describe("demoAt", () => {
  it("is idle before the loop starts and during the lead", () => {
    for (const t of [-3, 0, 0.99]) {
      expect(demoAt(timeline, t, pacing)).toEqual({
        cursor: undefined,
        played: 0,
        player: null,
        sounding: null,
      });
    }
  });

  it("moves the cursor through the notes at the tempo, colouring up to the one sounding", () => {
    const state = demoAt(timeline, 3.5, pacing);
    expect(state.cursor).toBeCloseTo(2.5);
    expect(state.played).toBe(3);
    expect(state.sounding).toBe(2);
  });

  it("gives the first half of the bars to the left herald and the rest to the right", () => {
    expect(demoAt(timeline, 4.9, pacing).player).toBe("left");
    expect(demoAt(timeline, 5.1, pacing).player).toBe("right");
  });

  it("has nothing sounding on a rest", () => {
    expect(demoAt(timeline, 6.5, pacing).sounding).toBeNull();
  });

  it("holds the whole phrase coloured after the last note, with no cursor", () => {
    expect(demoAt(timeline, 9.5, pacing)).toMatchObject({
      cursor: undefined,
      played: 8,
      player: null,
    });
  });

  it("starts again from nothing each period", () => {
    expect(demoAt(timeline, 11.5, pacing).played).toBe(0);
    expect(demoAt(timeline, 14.5, pacing).sounding).toBe(2);
  });
});

describe("valvesFor", () => {
  it("gives the standard fingering through the usual range", () => {
    expect(valvesFor(60)).toEqual([]); // C4
    expect(valvesFor(62)).toEqual([1, 3]); // D4
    expect(valvesFor(64)).toEqual([1, 2]); // E4
    expect(valvesFor(70)).toEqual([1]); // B♭4
    expect(valvesFor(74)).toEqual([1]); // D5
    expect(valvesFor(84)).toEqual([]); // C6
    expect(valvesFor(54)).toEqual([1, 2, 3]); // F♯3
  });

  it("leaves the valves up out of range", () => {
    expect(valvesFor(40)).toEqual([]);
    expect(valvesFor(96)).toEqual([]);
  });
});
