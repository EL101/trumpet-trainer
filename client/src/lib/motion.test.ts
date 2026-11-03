import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./motion";

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
