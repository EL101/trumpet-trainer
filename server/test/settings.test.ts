import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { DEFAULT_NOTE_RANGES } from "../src/etudes/music.js";
import { googleClaims, guestClaims, tokenFor } from "./firebaseMock.js";
import { createUser, exerciseBody, newUid } from "./helpers.js";

const bearer = (uid: string, guest = false) => ({
  Authorization: `Bearer ${tokenFor(guest ? guestClaims(uid) : googleClaims(uid))}`,
});

/** Low F#3–D5, Medium D4–A5, High C5–E6. */
const CUSTOM = { noteRanges: { LOW: [54, 74], MED: [62, 81], HIGH: [72, 88] } };

const put = (uid: string, body: unknown) =>
  request(app).put("/api/settings").set(bearer(uid)).send(body);

describe("GET /api/settings", () => {
  it("gives a user who never saved any the default ranges", async () => {
    const res = await request(app).get("/api/settings").set(bearer(newUid()));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ noteRanges: { LOW: [54, 72], MED: [60, 84], HIGH: [72, 91] } });
  });

  it("needs a signed-in user", async () => {
    expect((await request(app).get("/api/settings")).status).toBe(401);
  });
});

describe("PUT /api/settings", () => {
  it("saves the ranges, for the caller only", async () => {
    const uid = newUid();
    const other = newUid();
    await request(app).get("/api/settings").set(bearer(other));

    const res = await put(uid, CUSTOM);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(CUSTOM);

    expect((await request(app).get("/api/settings").set(bearer(uid))).body).toEqual(CUSTOM);
    expect((await request(app).get("/api/settings").set(bearer(other))).body).toEqual({
      noteRanges: DEFAULT_NOTE_RANGES,
    });
  });

  it("replaces what was saved before", async () => {
    const uid = newUid();
    await put(uid, CUSTOM);
    const next = { noteRanges: { ...CUSTOM.noteRanges, HIGH: [70, 91] } };
    await put(uid, next);
    expect((await request(app).get("/api/settings").set(bearer(uid))).body).toEqual(next);
  });

  it("lets guests save theirs too", async () => {
    const uid = newUid("guest");
    const res = await request(app).put("/api/settings").set(bearer(uid, true)).send(CUSTOM);
    expect(res.status).toBe(200);
  });

  it("keeps no row for the defaults, so the user follows them if they change", async () => {
    const uid = newUid();
    await put(uid, CUSTOM);
    const res = await put(uid, { noteRanges: DEFAULT_NOTE_RANGES });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ noteRanges: DEFAULT_NOTE_RANGES });
    expect(await prisma.userSettings.findUnique({ where: { userId: uid } })).toBeNull();
  });

  it.each([
    ["narrower than an octave", { LOW: [60, 71] }],
    ["below F#3", { LOW: [53, 72] }],
    ["above G6", { HIGH: [72, 92] }],
    ["upside down", { MED: [84, 60] }],
    ["not whole notes", { MED: [60.5, 84] }],
    ["without its top note", { MED: [60] }],
  ])("turns down a range %s, saving nothing", async (_, change) => {
    const uid = newUid();
    const res = await put(uid, { noteRanges: { ...CUSTOM.noteRanges, ...change } });
    expect(res.status).toBe(400);
    expect(await prisma.userSettings.findUnique({ where: { userId: uid } })).toBeNull();
  });

  it("turns down a body missing a range", async () => {
    const res = await put(newUid(), { noteRanges: { LOW: [54, 72], MED: [60, 84] } });
    expect(res.status).toBe(400);
  });
});

describe("user_settings constraints", () => {
  it("are enforced by the database too", async () => {
    const uid = newUid();
    await createUser(uid);
    const row = { userId: uid, lowMin: 54, lowMax: 72, medMin: 60, medMax: 84, highMin: 72 };
    await expect(prisma.userSettings.create({ data: { ...row, highMax: 92 } })).rejects.toThrow();
    await expect(prisma.userSettings.create({ data: { ...row, highMax: 80 } })).rejects.toThrow();
    await expect(
      prisma.userSettings.create({ data: { ...row, highMax: 91 } }),
    ).resolves.toBeTruthy();
  });
});

const exerciseRow = (userId: string) =>
  ({
    userId,
    exerciseId: randomUUID(),
    generationNum: 1,
    notes: "C4/w",
    exerciseType: "RANDOM",
    timeSig: "4/4",
    musicKey: "C major",
    noteRange: "MED",
    difficulty: "LOW",
  }) as const;

/** `count` scored runs of one exercise, straight into the table. */
async function addScores(userId: string, count: number) {
  const { exerciseId, exerciseType, timeSig, musicKey, noteRange, difficulty } =
    exerciseRow(userId);
  await prisma.practiceScore.createMany({
    data: Array.from({ length: count }, () => ({
      userId,
      exerciseId,
      exerciseType,
      timeSig,
      musicKey,
      noteRange,
      difficulty,
      tempo: 90,
      overall: 80,
      rightNotesScore: 80,
      rhythmScore: 80,
      intonationScore: 80,
      toneScore: 80,
    })),
  });
}

const stats = async (uid: string) =>
  (await request(app).get("/api/profile/stats").set(bearer(uid))).body;

describe("GET /api/profile/stats", () => {
  it("starts at nothing generated and nothing played", async () => {
    expect(await stats(newUid())).toEqual({ exercisesGenerated: 0, exercisesPlayed: 0 });
  });

  it("counts every exercise saved to history, though history is pruned", async () => {
    const uid = newUid();
    const save = () => request(app).post("/api/history").set(bearer(uid)).send(exerciseBody());
    const { generationNum: _, ...withoutNumber } = exerciseBody();
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/history").set(bearer(uid)).send(withoutNumber);
    }
    await prisma.history.deleteMany({ where: { userId: uid } });
    expect((await stats(uid)).exercisesGenerated).toBe(3);

    // An older client's numbered save counts once, however often it's repeated.
    await save();
    await save();
    expect((await stats(uid)).exercisesGenerated).toBe(4);
  });

  it("counts saves made at the same moment", async () => {
    const uid = newUid();
    const { generationNum: _, ...body } = exerciseBody();
    // The user's row first, so the saves race each other rather than its creation.
    await request(app).get("/api/settings").set(bearer(uid));
    await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post("/api/history").set(bearer(uid)).send(body),
      ),
    );
    expect((await stats(uid)).exercisesGenerated).toBe(5);
  });

  it("counts each exercise the caller has played once, however often it was replayed", async () => {
    const uid = newUid();
    const other = newUid();
    await createUser(uid);
    await createUser(other);
    await addScores(uid, 3);
    await addScores(uid, 1);
    await addScores(other, 2);
    expect((await stats(uid)).exercisesPlayed).toBe(2);
  });
});

describe("DELETE /api/scores", () => {
  it("deletes every scored run of the caller's, and nothing else", async () => {
    const uid = newUid();
    const other = newUid();
    await createUser(uid);
    await createUser(other);
    await prisma.history.create({ data: exerciseRow(uid) });
    await prisma.library.create({ data: exerciseRow(uid) });
    await prisma.user.update({ where: { id: uid }, data: { exercisesGenerated: 7 } });
    await put(uid, CUSTOM);
    await addScores(uid, 4);
    await addScores(other, 2);

    const res = await request(app).delete("/api/scores").set(bearer(uid));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 4 });
    expect(await stats(uid)).toEqual({ exercisesGenerated: 7, exercisesPlayed: 0 });
    expect(await prisma.practiceScore.count({ where: { userId: other } })).toBe(2);
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(1);
    expect(await prisma.library.count({ where: { userId: uid } })).toBe(1);
    expect((await request(app).get("/api/settings").set(bearer(uid))).body).toEqual(CUSTOM);
  });

  it("is fine with nothing to delete", async () => {
    const res = await request(app).delete("/api/scores").set(bearer(newUid()));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 0 });
  });

  it("needs a signed-in user", async () => {
    expect((await request(app).delete("/api/scores")).status).toBe(401);
  });
});
