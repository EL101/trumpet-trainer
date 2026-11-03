import { describe, expect, it } from "vitest";
import { readStored } from "./storage";

/** A storage holding `entries`, as getItem sees it. */
function storage(entries: Record<string, string>) {
  return { getItem: (key: string) => entries[key] ?? null };
}

const isNumber = (value: unknown): value is number => typeof value === "number";

describe("readStored", () => {
  it("reads the value stored as JSON", () => {
    expect(readStored(storage({ tempo: "96" }), "tempo", 80)).toBe(96);
    expect(readStored(storage({ plate: '{"id":"a"}' }), "plate", null)).toEqual({ id: "a" });
  });

  it("falls back when nothing is stored", () => {
    expect(readStored(storage({}), "tempo", 80)).toBe(80);
  });

  it("falls back when what's stored isn't JSON", () => {
    expect(readStored(storage({ tempo: "{" }), "tempo", 80)).toBe(80);
  });

  it("falls back when the check turns the value down", () => {
    expect(readStored(storage({ tempo: '"fast"' }), "tempo", 80, isNumber)).toBe(80);
    expect(readStored(storage({ tempo: "120" }), "tempo", 80, isNumber)).toBe(120);
  });

  it("falls back when storage throws", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    };
    expect(readStored(blocked, "tempo", 80)).toBe(80);
  });
});
