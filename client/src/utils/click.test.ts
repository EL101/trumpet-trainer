import { describe, expect, it, vi } from "vitest";
import { scheduleClick } from "./click";

/** An audio context that records the nodes a click is made of. */
function fakeContext() {
  const oscillators: {
    frequency: { value: number };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  const gains: {
    gain: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
  }[] = [];
  const ctx = {
    destination: { name: "speakers" },
    createOscillator() {
      const o = {
        type: "",
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(o);
      return o;
    },
    createGain() {
      const g = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn() };
      gains.push(g);
      return g;
    },
  };
  return {
    ctx: ctx as unknown as BaseAudioContext,
    destination: ctx.destination,
    oscillators,
    gains,
  };
}

describe("scheduleClick", () => {
  it("sounds at the time given, higher on an accent", () => {
    const plain = fakeContext();
    scheduleClick(1.5, false, plain.ctx);
    const accented = fakeContext();
    scheduleClick(1.5, true, accented.ctx);
    expect(plain.oscillators[0].start).toHaveBeenCalledWith(1.5);
    expect(accented.oscillators[0].frequency.value).toBeGreaterThan(
      plain.oscillators[0].frequency.value,
    );
  });

  it("gives each tone its own volume, the low one far under the high one", () => {
    const { ctx, oscillators, gains } = fakeContext();
    scheduleClick(0, false, ctx);
    oscillators.forEach((o, i) => expect(o.connect).toHaveBeenCalledWith(gains[i]));
    const peak = (g: (typeof gains)[number]) =>
      Math.max(...g.gain.setValueAtTime.mock.calls.map(([value]) => value as number));
    expect(peak(gains[1])).toBeLessThan(peak(gains[0]) / 10);
  });

  it("plays into the speakers by default", () => {
    const { ctx, destination, gains } = fakeContext();
    scheduleClick(0, false, ctx);
    for (const g of gains) expect(g.connect).toHaveBeenCalledWith(destination);
  });

  it("plays into the node it's given, so a player can silence its own clicks", () => {
    const { ctx, gains } = fakeContext();
    const bus = {} as AudioNode;
    scheduleClick(0, false, ctx, bus);
    for (const g of gains) expect(g.connect).toHaveBeenCalledWith(bus);
  });
});
