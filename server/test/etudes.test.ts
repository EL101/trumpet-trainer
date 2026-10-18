import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import type { NoteEvent } from "../src/etudes/music.js";
import { googleClaims, guestClaims, tokenFor } from "./firebaseMock.js";
import { createUser, newUid } from "./helpers.js";

// Claude is replaced by a fake whose replies each test queues up.
const claude = vi.hoisted(() => ({ create: vi.fn(), available: true }));
vi.mock("../src/etudes/claude.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/etudes/claude.js")>()),
  anthropic: () => (claude.available ? { messages: { create: claude.create } } : null),
}));

const n = (pitch: string | null, quarters: number): NoteEvent => ({ pitch, quarters });

/** Four bars of 4/4 in Bb major that pass every check, and meet medium difficulty's targets. */
const GOOD_BARS = [
  [n("F4", 0.5), n("Bb4", 0.5), n("D5", 1), n("F5", 2)],
  [n("Eb5", 0.5), n("C5", 0.5), n("A4", 1), n("F4", 2)],
  [n("D4", 1), n("F4", 0.5), n("Bb4", 0.5), n("D5", 1), n(null, 1)],
  [n("F4", 2), n("Bb4", 2)],
];

/** Four bars that pass every check but are far too easy for advanced. */
const EASY_BARS = [
  [n("Bb4", 2), n("C5", 2)],
  [n("D5", 2), n("C5", 2)],
  [n("Bb4", 1), n("C5", 1), n("D5", 2)],
  [n("Bb4", 4)],
];

const body = {
  musicKey: "Bb major",
  timeSig: "4/4",
  measures: 4,
  noteRange: "MED",
  difficulty: "MED",
};

/** A reply from Claude carrying `bars` as its JSON. */
const reply = (bars: unknown, usage = { input_tokens: 1_000, output_tokens: 2_000 }) => ({
  content: [{ type: "text", text: JSON.stringify({ bars }) }],
  stop_reason: "end_turn",
  usage,
});

const post = (token: string, data: object = body) =>
  request(app)
    .post("/api/etudes")
    .set({ Authorization: `Bearer ${token}` })
    .send(data);

const rows = (userId: string) => prisma.etudeGeneration.findMany({ where: { userId } });

beforeEach(() => {
  claude.create.mockReset();
  claude.available = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/etudes", () => {
  it("returns the etude and records what it cost", async () => {
    const uid = newUid();
    claude.create.mockResolvedValueOnce(reply(GOOD_BARS));

    const res = await post(tokenFor(googleClaims(uid)));

    expect(res.status).toBe(200);
    expect(res.body.bars).toEqual(GOOD_BARS);
    expect(res.body.quota).toMatchObject({ limit: 10, remaining: 9 });
    const [row] = await rows(uid);
    // Haiku 5.5: 1,000 tokens in at $0.10/M and 2,000 out at $0.50/M.
    expect(row).toMatchObject({
      status: "SUCCEEDED",
      model: "claude-haiku-5-5",
      inputTokens: 1_000,
      outputTokens: 2_000,
      costMicros: 1_100,
    });
  });

  it("sends a schema that limits pitches to the range and values to the difficulty", async () => {
    claude.create.mockResolvedValueOnce(reply(GOOD_BARS));
    await post(tokenFor(googleClaims(newUid())));

    const params = claude.create.mock.calls[0][0];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.output_config.effort).toBe("low");
    const note = params.output_config.format.schema.properties.bars.items.items.properties;
    expect(note.pitch.anyOf[0].enum[0]).toBe("C4");
    expect(note.quarters.enum).toEqual([4, 3, 2, 1.5, 1, 0.5]);
  });

  it("asks again once with the problems, and charges for both attempts", async () => {
    const uid = newUid();
    claude.create
      .mockResolvedValueOnce(reply([[n("D4", 3)], ...GOOD_BARS.slice(1)]))
      .mockResolvedValueOnce(reply(GOOD_BARS));

    const res = await post(tokenFor(googleClaims(uid)));

    expect(res.status).toBe(200);
    const retry = claude.create.mock.calls[1][0].messages;
    expect(retry).toHaveLength(3);
    expect(retry[1].role).toBe("assistant");
    expect(retry[2].content).toContain("Bar 1 adds up to 3 quarter notes");
    const [row] = await rows(uid);
    expect(row).toMatchObject({ inputTokens: 2_000, outputTokens: 4_000, costMicros: 2_200 });
  });

  it("asks again when an etude is too easy for its difficulty, then keeps the retry", async () => {
    claude.create.mockResolvedValue(reply(EASY_BARS));

    const res = await post(tokenFor(googleClaims(newUid())), { ...body, difficulty: "HIGH" });

    expect(res.status).toBe(200);
    expect(res.body.bars).toEqual(EASY_BARS);
    expect(claude.create).toHaveBeenCalledTimes(2);
    const [first, second] = claude.create.mock.calls.map((call) => call[0]);
    expect(first.output_config.effort).toBe("medium");
    expect(first.messages[0].content).toContain(
      "At least 40% of the notes are eighths or shorter.",
    );
    expect(second.messages[2].content).toContain("this difficulty needs at least 40%");
  });

  it("gives up after two bad attempts with 502, without using up the quota", async () => {
    const uid = newUid();
    claude.create.mockResolvedValue(reply([[n("Bb4", 4)]]));

    const res = await post(tokenFor(googleClaims(uid)));

    expect(res.status).toBe(502);
    expect(claude.create).toHaveBeenCalledTimes(2);
    expect(res.body.quota).toMatchObject({ remaining: 10 });
    const [row] = await rows(uid);
    expect(row).toMatchObject({ status: "FAILED", costMicros: 2_200 });
  });

  it("treats a reply that isn't JSON as a bad attempt", async () => {
    claude.create.mockResolvedValue({
      content: [{ type: "text", text: "Here is your etude!" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });
    const res = await post(tokenFor(googleClaims(newUid())));
    expect(res.status).toBe(502);
  });

  it("doesn't retry a refusal", async () => {
    claude.create.mockResolvedValue({ ...reply(GOOD_BARS), stop_reason: "refusal" });
    const res = await post(tokenFor(googleClaims(newUid())));
    expect(res.status).toBe(502);
    expect(claude.create).toHaveBeenCalledTimes(1);
  });

  it("answers 503 when Anthropic is busy, and keeps no record of a call that cost nothing", async () => {
    const uid = newUid();
    claude.create.mockRejectedValue(
      new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers()),
    );

    const res = await post(tokenFor(googleClaims(uid)));

    expect(res.status).toBe(503);
    expect(await rows(uid)).toHaveLength(0);
  });

  it("answers 503 when no API credentials are set up", async () => {
    claude.available = false;
    const res = await post(tokenFor(googleClaims(newUid())));
    expect(res.status).toBe(503);
    expect(claude.create).not.toHaveBeenCalled();
  });

  it("rejects a key it doesn't know, without calling Claude", async () => {
    const res = await post(tokenFor(googleClaims(newUid())), { ...body, musicKey: "H major" });
    expect(res.status).toBe(400);
    expect(claude.create).not.toHaveBeenCalled();
  });

  it("rejects a length outside 4 to 16 bars", async () => {
    const res = await post(tokenFor(googleClaims(newUid())), { ...body, measures: 40 });
    expect(res.status).toBe(400);
  });
});

describe("etude quota", () => {
  it("stops a user at the daily limit with 429 and when a slot frees", async () => {
    vi.stubEnv("ETUDE_DAILY_LIMIT", "2");
    const token = tokenFor(googleClaims(newUid()));
    claude.create.mockResolvedValue(reply(GOOD_BARS));

    expect((await post(token)).status).toBe(200);
    expect((await post(token)).status).toBe(200);
    const res = await post(token);

    expect(res.status).toBe(429);
    expect(res.body.quota.remaining).toBe(0);
    expect(new Date(res.body.quota.resetsAt).getTime()).toBeGreaterThan(Date.now());
    expect(claude.create).toHaveBeenCalledTimes(2);
  });

  it("refuses guests, without calling Claude", async () => {
    const token = tokenFor(guestClaims(newUid("guest")));

    const res = await post(token);
    const quota = await request(app)
      .get("/api/etudes/quota")
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Profile and settings/);
    expect(quota.status).toBe(403);
    expect(claude.create).not.toHaveBeenCalled();
  });

  it("counts only the last 24 hours", async () => {
    vi.stubEnv("ETUDE_DAILY_LIMIT", "1");
    const uid = newUid();
    await createUser(uid);
    await prisma.etudeGeneration.create({
      data: {
        userId: uid,
        model: "claude-haiku-5-5",
        status: "SUCCEEDED",
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    });
    claude.create.mockResolvedValue(reply(GOOD_BARS));

    expect((await post(tokenFor(googleClaims(uid)))).status).toBe(200);
  });

  it("lets only the limit through when requests arrive at once", async () => {
    vi.stubEnv("ETUDE_DAILY_LIMIT", "2");
    const uid = newUid();
    await createUser(uid);
    const token = tokenFor(googleClaims(uid));
    claude.create.mockResolvedValue(reply(GOOD_BARS));

    const statuses = (await Promise.all(Array.from({ length: 6 }, () => post(token)))).map(
      (r) => r.status,
    );

    expect(statuses.filter((s) => s === 200)).toHaveLength(2);
    expect(statuses.filter((s) => s === 429)).toHaveLength(4);
    expect(await rows(uid)).toHaveLength(2);
  });

  it("GET /api/etudes/quota reports what's left", async () => {
    const uid = newUid();
    const token = tokenFor(googleClaims(uid));
    claude.create.mockResolvedValue(reply(GOOD_BARS));
    await post(token);

    const res = await request(app)
      .get("/api/etudes/quota")
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ limit: 10, remaining: 9 });
  });
});

describe("daily spend cap", () => {
  it("pauses etudes for everyone once today's spending reaches it", async () => {
    vi.stubEnv("ETUDE_DAILY_SPEND_USD", "1");
    const other = newUid();
    await createUser(other);
    await prisma.etudeGeneration.create({
      data: {
        userId: other,
        model: "claude-haiku-5-5",
        status: "SUCCEEDED",
        costMicros: 1_000_000,
      },
    });

    const res = await post(tokenFor(googleClaims(newUid())));

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/paused until midnight UTC/);
    expect(claude.create).not.toHaveBeenCalled();
  });
});
