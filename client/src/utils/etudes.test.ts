import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { fetchEtude, startEtude, type EtudeJob, type EtudeRequest } from "./etudes";

const user = { getIdToken: async () => "token" } as unknown as User;

const request: EtudeRequest = {
  musicKey: "Bb major",
  timeSig: "4/4",
  measures: 4,
  noteRange: "MED",
  difficulty: "MED",
};

const quota = { limit: 10, remaining: 9, resetsAt: "2026-10-18T12:00:00.000Z" };
const pending: EtudeJob = { id: "etude-1", status: "PENDING", error: null, exercise: null };

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

describe("startEtude", () => {
  it("returns the job the server started, and the quota", async () => {
    respond(202, { etude: pending, quota });
    expect(await startEtude(user, request)).toEqual({ ok: true, job: pending, quota });
  });

  it("passes on the etude already being written when the server refuses a second", async () => {
    respond(409, { error: "An etude is already being written.", etude: pending, quota });
    expect(await startEtude(user, request)).toEqual({
      ok: false,
      message: "An etude is already being written.",
      job: pending,
      quota,
    });
  });

  it("passes on the server's message when it refuses", async () => {
    const used = { ...quota, remaining: 0 };
    respond(429, { error: "You've used all 10 etudes for today.", quota: used });
    expect(await startEtude(user, request)).toMatchObject({
      ok: false,
      message: "You've used all 10 etudes for today.",
      quota: used,
    });
  });

  it("falls back to its own message when the server sends none", async () => {
    respond(500, null);
    expect(await startEtude(user, request)).toMatchObject({
      ok: false,
      message: "Couldn't start an etude this time. Try again.",
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
    expect(await startEtude(user, request)).toEqual({
      ok: false,
      message: "Couldn't reach the server. Check your connection and try again.",
    });
  });
});

describe("fetchEtude", () => {
  it("returns how the etude is getting on", async () => {
    const done: EtudeJob = { ...pending, status: "FAILED", error: "Try again." };
    respond(200, { etude: done, quota });
    expect(await fetchEtude(user, "etude-1")).toEqual({ etude: done, quota });
  });

  it("reports an etude the server doesn't know as failed, so nothing waits for it", async () => {
    respond(404, { error: "No such etude" });
    expect(await fetchEtude(user, "etude-1")).toEqual({
      etude: {
        id: "etude-1",
        status: "FAILED",
        error: "That etude can't be found any more. Try generating another.",
        exercise: null,
      },
    });
  });

  it("returns null when it can't find out, so the caller asks again later", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    respond(500, null);
    expect(await fetchEtude(user, "etude-1")).toBeNull();
  });
});
