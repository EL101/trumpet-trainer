import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { etudeNotes, requestEtude, type EtudeRequest } from "./etudes";

const user = { getIdToken: async () => "token" } as unknown as User;

const request: EtudeRequest = {
  musicKey: "Bb major",
  timeSig: "4/4",
  measures: 4,
  noteRange: "MED",
  difficulty: "MED",
};

const quota = { limit: 10, remaining: 9, resetsAt: "2026-10-18T12:00:00.000Z" };

/** Answer every fetch with `status` and `body` as JSON. */
function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("etudeNotes", () => {
  it("writes the bars out in the app's note format, dotted values and rests included", () => {
    const bars = [
      [
        { pitch: "D4", quarters: 1.5 },
        { pitch: "Eb4", quarters: 0.5 },
        { pitch: null, quarters: 2 },
      ],
      [{ pitch: "Bb4", quarters: 4 }],
    ];
    expect(etudeNotes(bars, "4/4")).toBe("D4/q., Eb4/8, B4/h/r, Bb4/w");
  });
});

describe("requestEtude", () => {
  it("returns the etude's notes and the quota", async () => {
    respond(200, { bars: [[{ pitch: "Bb4", quarters: 4 }]], quota });
    expect(await requestEtude(user, request)).toEqual({ ok: true, notes: "Bb4/w", quota });
  });

  it("passes on the server's message and quota when it refuses", async () => {
    const used = { ...quota, remaining: 0 };
    respond(429, { error: "You've used all 10 etudes for today.", quota: used });
    expect(await requestEtude(user, request)).toEqual({
      ok: false,
      message: "You've used all 10 etudes for today.",
      quota: used,
    });
  });

  it("falls back to its own message when the server sends none", async () => {
    respond(500, null);
    const result = await requestEtude(user, request);
    expect(result).toMatchObject({
      ok: false,
      message: "Couldn't write an etude this time. Try again.",
    });
  });

  it("says so when the server can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await requestEtude(user, request)).toEqual({
      ok: false,
      message: "Couldn't reach the server. Check your connection and try again.",
    });
  });
});
