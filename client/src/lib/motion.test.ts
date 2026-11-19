import { afterEach, describe, expect, it, vi } from "vitest";
import { countUpAt, prefersReducedMotion } from "./motion";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A window whose media queries match only `matching`. */
function stubWindow(matching: string | null) {
  vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: query === matching }) });
}

describe("prefersReducedMotion", () => {
  it("is true when the viewer asks for reduced motion", () => {
    stubWindow("(prefers-reduced-motion: reduce)");
    expect(prefersReducedMotion()).toBe(true);
  });

  it("is false when they don't", () => {
    stubWindow(null);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is false without matchMedia, or without a window at all", () => {
    vi.stubGlobal("window", {});
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("countUpAt", () => {
  it("runs from 0 to the target", () => {
    expect(countUpAt(195, 0, 800)).toBe(0);
    expect(countUpAt(195, 800, 800)).toBe(195);
    expect(countUpAt(195, 2000, 800)).toBe(195);
  });

  it("covers most of the way early, then settles", () => {
    expect(countUpAt(100, 400, 800)).toBe(88);
    expect(countUpAt(100, 200, 800)).toBeGreaterThan(50);
  });

  it("gives whole numbers that never go back", () => {
    let last = 0;
    for (let ms = 0; ms <= 800; ms += 16) {
      const n = countUpAt(37, ms, 800);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it("lands at once with no time to count in", () => {
    expect(countUpAt(12, 0, 0)).toBe(12);
  });
});
