import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import type { NoteEvent } from "../src/etudes/music.js";
import { costMicros, ETUDE_MODEL } from "../src/etudes/claude.js";
import { MAX_USAGE } from "../src/etudes/generate.js";
import { etudesSettled, runningEtudeIds } from "../src/etudes/run.js";
import { failInterruptedEtudes, STALE_AFTER_MS } from "../src/queries/etudes.js";
import { shutdown } from "../src/shutdown.js";
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
/** GOOD_BARS as history stores them. */
const GOOD_NOTES =
  "F4/8, Bb4/8, D5/q, F5/h, Eb5/8, C5/8, A4/q, F4/h, D4/q, F4/8, Bb4/8, D5/q, B4/q/r, F4/h, Bb4/h";

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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const post = (token: string, data: object = body) =>
  request(app).post("/api/etudes").set(auth(token)).send(data);

const get = (token: string, path: string) =>
  request(app).get(`/api/etudes${path}`).set(auth(token));

/** Start an etude, let it finish, and return how it ended as GET /api/etudes/:id reports it. */
async function generate(token: string, data: object = body) {
  const started = await post(token, data);
  await etudesSettled();
  if (started.status !== 202) return { started, finished: null };
  const finished = await get(token, `/${started.body.etude.id}`);
  return { started, finished };
}

const rows = (userId: string) => prisma.etudeGeneration.findMany({ where: { userId } });

/** Claude's reply waits until `finish` is called, so the etude stays pending meanwhile. */
function holdReply() {
  let finish!: () => void;
  claude.create.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = () => resolve(reply(GOOD_BARS));
    }),
  );
  return () => finish();
}

beforeEach(() => {
  claude.create.mockReset();
  claude.available = true;
});

afterEach(async () => {
  await etudesSettled();
  vi.unstubAllEnvs();
});

describe("POST /api/etudes", () => {
  it("answers at once, then writes the etude, saves it to history and records its cost", async () => {
    const uid = newUid();
    const token = tokenFor(googleClaims(uid));
    claude.create.mockResolvedValueOnce(reply(GOOD_BARS));

    const { started, finished } = await generate(token);

    expect(started.status).toBe(202);
    expect(started.body.etude).toMatchObject({ status: "PENDING", exercise: null });
    expect(started.body.quota).toMatchObject({ limit: 10, remaining: 9 });

    expect(finished!.status).toBe(200);
    expect(finished!.body.etude).toMatchObject({
      status: "SUCCEEDED",
      error: null,
      exercise: {
        exerciseType: "ETUDES",
        notes: GOOD_NOTES,
        musicKey: "Bb major",
        timeSig: "4/4",
        noteRange: "MED",
        difficulty: "MED",
        generationNum: 1,
      },
    });
    const history = await prisma.history.findMany({ where: { userId: uid } });
    expect(history).toHaveLength(1);
    const [row] = await rows(uid);
    // Haiku 5.5: 1,000 tokens in at $0.10/M and 2,000 out at $0.50/M.
    expect(row).toMatchObject({
      status: "SUCCEEDED",
      model: "claude-haiku-5-5",
      inputTokens: 1_000,
      outputTokens: 2_000,
      costMicros: 1_100,
      exerciseId: history[0].exerciseId,
    });
  });

  it("sends a schema that limits pitches to the range and values to the difficulty", async () => {
    claude.create.mockResolvedValueOnce(reply(GOOD_BARS));
    await generate(tokenFor(googleClaims(newUid())));

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

    const { finished } = await generate(tokenFor(googleClaims(uid)));

    expect(finished!.body.etude.status).toBe("SUCCEEDED");
    const retry = claude.create.mock.calls[1][0].messages;
    expect(retry).toHaveLength(3);
    expect(retry[1].role).toBe("assistant");
    expect(retry[2].content).toContain("Bar 1 adds up to 3 quarter notes");
    const [row] = await rows(uid);
    expect(row).toMatchObject({ inputTokens: 2_000, outputTokens: 4_000, costMicros: 2_200 });
  });

  it("asks again when an etude is too easy for its difficulty, then keeps the retry", async () => {
    claude.create.mockResolvedValue(reply(EASY_BARS));

    const { finished } = await generate(tokenFor(googleClaims(newUid())), {
      ...body,
      difficulty: "HIGH",
    });

    expect(finished!.body.etude.status).toBe("SUCCEEDED");
    expect(claude.create).toHaveBeenCalledTimes(2);
    const [first, second] = claude.create.mock.calls.map((call) => call[0]);
    expect(first.output_config.effort).toBe("medium");
    expect(first.messages[0].content).toContain(
      "At least 40% of the notes are eighths or shorter.",
    );
    expect(second.messages[2].content).toContain("this difficulty needs at least 40%");
  });

  it("records a failure with its message, without using up the quota or saving anything", async () => {
    const uid = newUid();
    claude.create.mockResolvedValue(reply([[n("Bb4", 4)]]));

    const { finished } = await generate(tokenFor(googleClaims(uid)));

    expect(claude.create).toHaveBeenCalledTimes(2);
    expect(finished!.body.etude).toMatchObject({
      status: "FAILED",
      error: "Couldn't write a usable etude this time. Try again.",
      exercise: null,
    });
    expect(finished!.body.quota).toMatchObject({ remaining: 10 });
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(0);
    const [row] = await rows(uid);
    expect(row).toMatchObject({ status: "FAILED", costMicros: 2_200 });
  });

  it("treats a reply that isn't JSON as a bad attempt", async () => {
    claude.create.mockResolvedValue({
      content: [{ type: "text", text: "Here is your etude!" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 },
    });
    const { finished } = await generate(tokenFor(googleClaims(newUid())));
    expect(finished!.body.etude.status).toBe("FAILED");
  });

  it("doesn't retry a refusal", async () => {
    claude.create.mockResolvedValue({ ...reply(GOOD_BARS), stop_reason: "refusal" });
    const { finished } = await generate(tokenFor(googleClaims(newUid())));
    expect(finished!.body.etude.status).toBe("FAILED");
    expect(claude.create).toHaveBeenCalledTimes(1);
  });

  it("says so when Anthropic is busy, at no cost", async () => {
    const uid = newUid();
    claude.create.mockRejectedValue(
      new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers()),
    );

    const { finished } = await generate(tokenFor(googleClaims(uid)));

    expect(finished!.body.etude).toMatchObject({
      status: "FAILED",
      error: "The etude writer can't be reached right now. Try again in a minute.",
    });
    const [row] = await rows(uid);
    expect(row.costMicros).toBe(0);
  });

  it("answers 503 when no API credentials are set up", async () => {
    claude.available = false;
    const res = await post(tokenFor(googleClaims(newUid())));
    expect(res.status).toBe(503);
    expect(claude.create).not.toHaveBeenCalled();
  });

  it("tells GET /api/etudes/quota whether etudes can be written here", async () => {
    const token = tokenFor(googleClaims(newUid()));
    expect((await get(token, "/quota")).body.enabled).toBe(true);
    claude.available = false;
    expect((await get(token, "/quota")).body.enabled).toBe(false);
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

describe("an etude being written", () => {
  it("is reported by GET /api/etudes/quota, so a reloaded page can wait for it", async () => {
    const token = tokenFor(googleClaims(newUid()));
    const finish = holdReply();
    const started = await post(token);

    const during = await get(token, "/quota");
    expect(during.body).toMatchObject({
      remaining: 9,
      pending: { id: started.body.etude.id, status: "PENDING" },
    });

    finish();
    await etudesSettled();
    expect((await get(token, "/quota")).body.pending).toBeNull();
  });

  it("keeps a second from starting until it's done", async () => {
    const token = tokenFor(googleClaims(newUid()));
    const finish = holdReply();
    const started = await post(token);

    const second = await post(token);

    expect(second.status).toBe(409);
    expect(second.body.etude.id).toBe(started.body.etude.id);
    finish();
  });

  it("is given up as interrupted once it's been pending too long, returning its quota", async () => {
    const uid = newUid();
    await createUser(uid);
    const stale = await prisma.etudeGeneration.create({
      data: {
        userId: uid,
        model: "claude-haiku-5-5",
        createdAt: new Date(Date.now() - STALE_AFTER_MS - 1000),
      },
    });
    const token = tokenFor(googleClaims(uid));

    const res = await get(token, `/${stale.id}`);

    expect(res.body.etude).toMatchObject({
      status: "FAILED",
      error: "Writing that etude was interrupted. Try again.",
    });
    expect(res.body.quota.remaining).toBe(10);
  });

  it("still counts if it finishes after being given up, with its cost recorded", async () => {
    const uid = newUid();
    const token = tokenFor(googleClaims(uid));
    const finish = holdReply();
    const started = await post(token);
    const id: string = started.body.etude.id;
    // Pretend it's been running past the cutoff, so the next request gives it up.
    await prisma.etudeGeneration.update({
      where: { id },
      data: { createdAt: new Date(Date.now() - STALE_AFTER_MS - 1000) },
    });
    expect((await get(token, `/${id}`)).body.etude.status).toBe("FAILED");

    finish();
    await etudesSettled();

    const res = await get(token, `/${id}`);
    expect(res.body.etude).toMatchObject({ status: "SUCCEEDED", error: null });
    expect(res.body.etude.exercise.notes).toBe(GOOD_NOTES);
    const [row] = await rows(uid);
    expect(row.costMicros).toBeGreaterThan(0);
  });

  it("is tracked as running in this process until it settles", async () => {
    const finish = holdReply();
    const started = await post(tokenFor(googleClaims(newUid())));
    const id: string = started.body.etude.id;

    expect(runningEtudeIds()).toContain(id);
    finish();
    await etudesSettled();
    expect(runningEtudeIds()).not.toContain(id);
  });

  it("is the only one per user the database allows", async () => {
    const uid = newUid();
    await createUser(uid);
    const pending = { userId: uid, model: "claude-haiku-5-5" };
    await prisma.etudeGeneration.create({ data: pending });
    await prisma.etudeGeneration.create({ data: { ...pending, status: "FAILED" } });

    await expect(prisma.etudeGeneration.create({ data: pending })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("is only shown to its own user", async () => {
    const finish = holdReply();
    const started = await post(tokenFor(googleClaims(newUid())));

    const res = await get(tokenFor(googleClaims(newUid())), `/${started.body.etude.id}`);

    expect(res.status).toBe(404);
    finish();
  });
});

describe("etude quota", () => {
  it("stops a user at the daily limit with 429 and when a slot frees", async () => {
    vi.stubEnv("ETUDE_DAILY_LIMIT", "2");
    const token = tokenFor(googleClaims(newUid()));
    claude.create.mockResolvedValue(reply(GOOD_BARS));

    expect((await generate(token)).started.status).toBe(202);
    expect((await generate(token)).started.status).toBe(202);
    const res = await post(token);

    expect(res.status).toBe(429);
    expect(res.body.quota.remaining).toBe(0);
    expect(new Date(res.body.quota.resetsAt).getTime()).toBeGreaterThan(Date.now());
    expect(claude.create).toHaveBeenCalledTimes(2);
  });

  it("refuses guests, without calling Claude", async () => {
    const token = tokenFor(guestClaims(newUid("guest")));

    const res = await post(token);
    const quota = await get(token, "/quota");

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

    expect((await generate(tokenFor(googleClaims(uid)))).started.status).toBe(202);
  });

  it("starts only one etude when requests arrive at once", async () => {
    const uid = newUid();
    await createUser(uid);
    const token = tokenFor(googleClaims(uid));
    // Claude doesn't answer until every request is in, so the first stays pending.
    let finish!: () => void;
    const answered = new Promise<void>((resolve) => (finish = resolve));
    claude.create.mockImplementation(() => answered.then(() => reply(GOOD_BARS)));

    const statuses = (await Promise.all(Array.from({ length: 6 }, () => post(token)))).map(
      (r) => r.status,
    );
    finish();

    expect(statuses.filter((s) => s === 202)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(await rows(uid)).toHaveLength(1);
  });

  it("GET /api/etudes/quota reports what's left", async () => {
    const token = tokenFor(googleClaims(newUid()));
    claude.create.mockResolvedValue(reply(GOOD_BARS));
    await generate(token);

    const res = await get(token, "/quota");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ limit: 10, remaining: 9, pending: null });
  });
});

describe("daily spend cap", () => {
  /** What an etude is booked at until it's written. */
  const booked = costMicros(ETUDE_MODEL, MAX_USAGE.inputTokens, MAX_USAGE.outputTokens);

  it("books an etude at the most it can cost until it's written, then at what it cost", async () => {
    const uid = newUid();
    const finish = holdReply();
    await post(tokenFor(googleClaims(uid)));
    expect((await rows(uid))[0].costMicros).toBe(booked);

    finish();
    await etudesSettled();
    expect((await rows(uid))[0].costMicros).toBe(1_100);
  });

  it("counts etudes still being written towards it", async () => {
    // Room for one etude at its booked cost, but not two.
    vi.stubEnv("ETUDE_DAILY_SPEND_USD", String((booked * 1.5) / 1_000_000));
    const finish = holdReply();
    expect((await post(tokenFor(googleClaims(newUid())))).status).toBe(202);

    const res = await post(tokenFor(googleClaims(newUid())));

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/paused until midnight UTC/);
    finish();
  });

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

describe("failInterruptedEtudes", () => {
  it("fails only the given etudes that are still pending", async () => {
    const uid = newUid();
    const other = newUid();
    await createUser(uid);
    await createUser(other);
    const make = (userId: string, status: "PENDING" | "SUCCEEDED") =>
      prisma.etudeGeneration.create({ data: { userId, model: "claude-haiku-5-5", status } });
    const mine = await make(uid, "PENDING");
    const done = await make(uid, "SUCCEEDED");
    const theirs = await make(other, "PENDING");

    const { count } = await failInterruptedEtudes([mine.id, done.id]);

    expect(count).toBe(1);
    const status = async (id: string) =>
      prisma.etudeGeneration.findUniqueOrThrow({
        where: { id },
        select: { status: true, error: true },
      });
    expect(await status(mine.id)).toEqual({
      status: "FAILED",
      error: "The server restarted while writing your etude. Try again.",
    });
    expect(await status(done.id)).toEqual({ status: "SUCCEEDED", error: null });
    expect(await status(theirs.id)).toEqual({ status: "PENDING", error: null });
  });
});

describe("shutdown", () => {
  /** A server of our own to stop, since supertest's close by themselves. */
  async function listening() {
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    return server;
  }

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("stops listening and marks etudes still running after the grace period as interrupted", async () => {
    const uid = newUid();
    const finish = holdReply();
    await post(tokenFor(googleClaims(uid)));
    const server = await listening();

    await shutdown(server, 50);

    expect(server.listening).toBe(false);
    expect((await rows(uid))[0]).toMatchObject({
      status: "FAILED",
      error: "The server restarted while writing your etude. Try again.",
    });
    finish();
  });

  it("lets an etude that finishes within the grace period keep its result", async () => {
    const uid = newUid();
    const finish = holdReply();
    await post(tokenFor(googleClaims(uid)));
    const server = await listening();

    const stopped = shutdown(server, 10_000);
    finish();
    await stopped;

    expect((await rows(uid))[0]).toMatchObject({ status: "SUCCEEDED", error: null });
  });
});
