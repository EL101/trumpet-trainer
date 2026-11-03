import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTrumpet } from "./trumpet";

const RATE = 1000;
/** Every sample: three seconds of silence with one rising edge near each loop point. */
const EDGES = { start: 520, end: 2611 };

function param() {
  return {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

/** An audio context that "decodes" a fetched URL into a buffer that remembers it. */
function fakeContext({ edges = true } = {}) {
  const wave = new Float32Array(3 * RATE);
  if (edges) {
    wave[EDGES.start] = 0.5;
    wave[EDGES.end] = 0.5;
  }
  const sources: ReturnType<typeof source>[] = [];
  const gains: ReturnType<typeof gain>[] = [];
  function source() {
    let started = false;
    return {
      buffer: null as unknown,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null as null | (() => void),
      connect: vi.fn(<T>(node: T) => node),
      start: vi.fn<(when: number) => void>(() => {
        started = true;
      }),
      // As browsers do, refuses a stop time before the source has a start time.
      stop: vi.fn<(when: number) => void>(() => {
        if (!started) throw new Error("InvalidStateError: stop before start");
      }),
    };
  }
  function gain() {
    return { gain: param(), connect: vi.fn(<T>(node: T) => node), disconnect: vi.fn() };
  }
  const ctx = {
    currentTime: 0,
    decodeAudioData: vi.fn(async (url: string) => ({
      url,
      sampleRate: RATE,
      duration: 3,
      getChannelData: () => wave,
    })),
    createBufferSource() {
      const s = source();
      sources.push(s);
      return s;
    },
    createGain() {
      const g = gain();
      gains.push(g);
      return g;
    },
  };
  const clock = (time: number) => {
    ctx.currentTime = time;
  };
  return { ctx: ctx as unknown as BaseAudioContext, sources, gains, clock };
}

/** Answers each sample's fetch with its own URL, which the fake context decodes; `failing` 404s. */
function serveSamples(failing?: string) {
  const fetch = vi.fn(async (url: string) => ({
    ok: !failing || !url.endsWith(failing),
    status: failing && url.endsWith(failing) ? 404 : 200,
    arrayBuffer: async () => url,
  }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const output = {} as AudioNode;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loadTrumpet", () => {
  it("fetches the thirteen samples once per audio context", async () => {
    const fetch = serveSamples();
    const { ctx } = fakeContext();
    const first = loadTrumpet(ctx);
    expect(loadTrumpet(ctx)).toBe(first);
    await first;
    expect(fetch).toHaveBeenCalledTimes(13);
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/samples/trumpet/Bb4.mp3");
  });

  it("fails when a sample can't be fetched, and tries again next time", async () => {
    serveSamples("Db5.mp3");
    const { ctx } = fakeContext();
    await expect(loadTrumpet(ctx)).rejects.toThrow("Couldn't load the trumpet's Db5 (404)");
    const fetch = serveSamples();
    await expect(loadTrumpet(ctx)).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(13);
  });
});

describe("Trumpet.play", () => {
  async function trumpet(options?: { edges?: boolean }) {
    serveSamples();
    const fake = fakeContext(options);
    return { ...fake, trumpet: await loadTrumpet(fake.ctx) };
  }

  it("plays the nearest sample, repitched to the note", async () => {
    const { trumpet: t, sources } = await trumpet();
    // A4 (69) is a semitone below the B♭4 sample and two above G4's.
    t.play(69, 1, 0.5, output);
    const [s] = sources;
    expect((s.buffer as { url: string }).url).toBe("/samples/trumpet/Bb4.mp3");
    expect(s.playbackRate.value).toBeCloseTo(2 ** (-1 / 12));
  });

  it("plays a sample's own note at its own speed", async () => {
    const { trumpet: t, sources } = await trumpet();
    t.play(67, 1, 0.5, output);
    expect((sources[0].buffer as { url: string }).url).toBe("/samples/trumpet/G4.mp3");
    expect(sources[0].playbackRate.value).toBe(1);
  });

  it("stretches the nearest sample for notes beyond the samples' range", async () => {
    const { trumpet: t, sources } = await trumpet();
    t.play(48, 1, 0.5, output);
    expect((sources[0].buffer as { url: string }).url).toBe("/samples/trumpet/E3.mp3");
    expect(sources[0].playbackRate.value).toBeCloseTo(2 ** (-4 / 12));
  });

  it("loops through the sample's middle, joining at rising zero crossings", async () => {
    const { trumpet: t, sources } = await trumpet();
    t.play(67, 1, 8, output);
    expect(sources[0]).toMatchObject({
      loop: true,
      loopStart: EDGES.start / RATE,
      loopEnd: EDGES.end / RATE,
    });
  });

  it("loops from the nominal points when the wave has no crossing there", async () => {
    const { trumpet: t, sources } = await trumpet({ edges: false });
    t.play(67, 1, 8, output);
    expect(sources[0]).toMatchObject({ loopStart: 0.5, loopEnd: 2.6 });
  });

  it("fades in, holds for the note's length, then fades out", async () => {
    const { trumpet: t, sources, gains } = await trumpet();
    t.play(67, 2, 1.5, output);
    const [envelope] = gains;
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0, 2);
    expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(3, 3.5);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 3.62);
    expect(sources[0].start).toHaveBeenCalledWith(2);
    expect(sources[0].stop).toHaveBeenCalledWith(3.62);
    expect(envelope.connect).toHaveBeenCalledWith(output);
  });

  it("gives a note too short to fade in at least the fade", async () => {
    const { trumpet: t, sources } = await trumpet();
    t.play(67, 2, 0, output);
    expect(sources[0].stop.mock.calls[0][0]).toBeCloseTo(2.14);
  });

  it("moves a note's end, as after a tempo change", async () => {
    const { trumpet: t, sources, gains, clock } = await trumpet();
    const note = t.play(67, 2, 1.5, output);
    clock(2.5);
    note.endAt(4);
    const [envelope] = gains;
    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(2.5);
    expect(envelope.gain.setValueAtTime).toHaveBeenLastCalledWith(3, 4);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 4.12);
    expect(sources[0].stop).toHaveBeenLastCalledWith(4.12);
  });

  it("keeps the attack of a note that hasn't finished fading in", async () => {
    const { trumpet: t, gains, clock } = await trumpet();
    const note = t.play(67, 2, 1.5, output);
    clock(1);
    note.endAt(2.01);
    expect(gains[0].gain.cancelScheduledValues.mock.calls[0][0]).toBeCloseTo(2.0201);
    expect(gains[0].gain.setValueAtTime.mock.lastCall?.[1]).toBeCloseTo(2.02);
  });

  it("ends a note no earlier than now", async () => {
    const { trumpet: t, sources, clock } = await trumpet();
    const note = t.play(67, 2, 1.5, output);
    clock(2.5);
    note.endAt(2.2);
    expect(sources[0].stop.mock.lastCall?.[0]).toBeCloseTo(2.62);
  });

  it("lets a note that's already releasing finish", async () => {
    const { trumpet: t, sources, gains, clock } = await trumpet();
    const note = t.play(67, 2, 1.5, output);
    clock(3.55);
    note.endAt(5);
    expect(gains[0].gain.cancelScheduledValues).not.toHaveBeenCalled();
    expect(sources[0].stop).toHaveBeenCalledTimes(1);
  });

  it("lets go of the note's envelope once it has played", async () => {
    const { trumpet: t, sources, gains } = await trumpet();
    t.play(67, 2, 1, output);
    sources[0].onended?.();
    expect(gains[0].disconnect).toHaveBeenCalled();
  });
});
