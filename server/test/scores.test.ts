import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { FEEDBACK_PER_EXERCISE, pruneFeedback } from "../src/queries/scores.js";
import { googleClaims, tokenFor } from "./firebaseMock.js";
import { createUser, newUid } from "./helpers.js";

const bearer = (uid: string) => ({ Authorization: `Bearer ${tokenFor(googleClaims(uid))}` });

/** What an exercise was, as its score keeps it. */
const exerciseInfo = {
  exerciseType: "SCALES",
  timeSig: "3/4",
  musicKey: "Bb major",
  noteRange: "MED",
  difficulty: "LOW",
} as const;

const exerciseRow = (userId: string, exerciseId: string, generationNum = 1) => ({
  userId,
  exerciseId,
  generationNum,
  notes: "C4/h.",
  ...exerciseInfo,
});

/** A user with one exercise in `table`; returns the exercise's id. */
async function userWithExercise(uid: string, table: "history" | "library" = "history") {
  await createUser(uid);
  const exerciseId = randomUUID();
  if (table === "history") await prisma.history.create({ data: exerciseRow(uid, exerciseId) });
  else await prisma.library.create({ data: exerciseRow(uid, exerciseId) });
  return exerciseId;
}

const scoreBody = (exerciseId: string, overall = 83) => ({
  exerciseId,
  tempo: 92,
  overall,
  rightNotesScore: 88,
  rhythmScore: 68,
  intonationScore: 94,
  toneScore: 84,
  rightNotesFeedback: [
    {
      bar: 3,
      beat: 2,
      text: "Played C5 for E5.",
      index: 9,
      written: 76,
      played: 72,
      playedLength: 0.5,
    },
  ],
  rhythmFeedback: [{ bar: 2, endBar: 3, text: "Rushed, coming in early." }],
  intonationFeedback: [],
  toneFeedback: [{ bar: 8, beat: 1, text: "The note wavered." }],
});

/** Scores straight into the table, `at` minutes in. */
async function addScores(userId: string, exerciseId: string, ...at: number[]) {
  const start = Date.UTC(2026, 0, 1);
  await prisma.practiceScore.createMany({
    data: at.map((minutes, i) => ({
      ...scoreBody(exerciseId, i),
      ...exerciseInfo,
      userId,
      createdAt: new Date(start + minutes * 60_000),
    })),
  });
}

const post = (uid: string, body: object) =>
  request(app).post("/api/scores").set(bearer(uid)).send(body);
const latest = (uid: string, exerciseId: string) =>
  request(app).get(`/api/scores/latest/${exerciseId}`).set(bearer(uid));

describe("POST /api/scores", () => {
  it("saves each score and its feedback in its own column", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);

    const res = await post(uid, scoreBody(exerciseId));

    expect(res.status).toBe(201);
    const row = await prisma.practiceScore.findFirstOrThrow({ where: { userId: uid } });
    expect(row).toMatchObject({
      exerciseId,
      ...exerciseInfo,
      tempo: 92,
      overall: 83,
      rightNotesScore: 88,
      rhythmScore: 68,
      intonationScore: 94,
      toneScore: 84,
      intonationFeedback: [],
    });
    expect(row.rightNotesFeedback).toEqual(scoreBody(exerciseId).rightNotesFeedback);
    expect(row.rhythmFeedback).toEqual([{ bar: 2, endBar: 3, text: "Rushed, coming in early." }]);
  });

  it("scores an exercise that's only in the library", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid, "library");

    expect((await post(uid, scoreBody(exerciseId))).status).toBe(201);
    const row = await prisma.practiceScore.findFirstOrThrow({ where: { userId: uid } });
    expect(row).toMatchObject(exerciseInfo);
  });

  it("keeps what the exercise was from its own row, not from the request", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);

    await post(uid, { ...scoreBody(exerciseId), musicKey: "F# major", difficulty: "HIGH" });

    const row = await prisma.practiceScore.findFirstOrThrow({ where: { userId: uid } });
    expect(row).toMatchObject({ musicKey: "Bb major", difficulty: "LOW" });
  });

  it("turns down an exercise that isn't the user's", async () => {
    const owner = newUid();
    const exerciseId = await userWithExercise(owner);
    const other = newUid();

    const res = await post(other, scoreBody(exerciseId));

    expect(res.status).toBe(404);
    expect(await prisma.practiceScore.count()).toBe(0);
  });

  it.each([
    ["a score over 100", { overall: 101 }],
    ["a score that isn't whole", { rhythmScore: 72.5 }],
    ["feedback without any text", { toneFeedback: [{ bar: 2 }] }],
    ["a missing column", { intonationScore: undefined }],
  ])("rejects %s", async (_, change) => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);

    const res = await post(uid, { ...scoreBody(exerciseId), ...change });

    expect(res.status).toBe(400);
  });

  it("needs a signed-in user", async () => {
    const res = await request(app).post("/api/scores").send(scoreBody(randomUUID()));
    expect(res.status).toBe(401);
  });
});

/** Scores straight into the table, saved `ago` minutes back from now. */
async function addRecentScores(userId: string, exerciseId: string, ago: number[]) {
  await prisma.practiceScore.createMany({
    data: ago.map((minutes) => ({
      ...scoreBody(exerciseId),
      ...exerciseInfo,
      userId,
      createdAt: new Date(Date.now() - minutes * 60_000),
    })),
  });
}

describe("POST /api/scores rate limit", () => {
  it("turns down an eleventh run in a minute, saying which limit", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    await addRecentScores(uid, exerciseId, Array(10).fill(0.5));

    const res = await post(uid, scoreBody(exerciseId));

    expect(res.status).toBe(429);
    expect(res.body.limit).toEqual({ max: 10, per: "minute" });
    expect(await prisma.practiceScore.count({ where: { userId: uid } })).toBe(10);
  });

  it("turns down a 301st run in a day, spread out over it", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    // One every 4 minutes, from 2 minutes ago back 20 hours: none in the last minute.
    await addRecentScores(
      uid,
      exerciseId,
      Array.from({ length: 300 }, (_, i) => 2 + i * 4),
    );

    const res = await post(uid, scoreBody(exerciseId));

    expect(res.status).toBe(429);
    expect(res.body.limit).toEqual({ max: 300, per: "day" });
  });

  it("counts only the runs inside each window", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    // Ten a couple of minutes ago, and 300 more over a day ago.
    await addRecentScores(uid, exerciseId, Array(10).fill(2));
    await addRecentScores(uid, exerciseId, Array(300).fill(24 * 60 + 5));

    expect((await post(uid, scoreBody(exerciseId))).status).toBe(201);
  });

  it("counts each user's runs on their own", async () => {
    const busy = newUid();
    const busyExercise = await userWithExercise(busy);
    await addRecentScores(busy, busyExercise, Array(10).fill(0.5));
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);

    expect((await post(uid, scoreBody(exerciseId))).status).toBe(201);
  });

  it("lets only ten of twelve saves sent at once through", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);

    const statuses = (
      await Promise.all(Array.from({ length: 12 }, () => post(uid, scoreBody(exerciseId))))
    ).map((res) => res.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(10);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
    expect(await prisma.practiceScore.count({ where: { userId: uid } })).toBe(10);
  });
});

describe("GET /api/scores/latest/:exerciseId", () => {
  it("sends the newest scored run of the exercise", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    await addScores(uid, exerciseId, 0, 10, 5);

    const res = await latest(uid, exerciseId);

    expect(res.status).toBe(200);
    // The second row added (overall 1) is the newest, at 10 minutes.
    expect(res.body).toMatchObject({ exerciseId, overall: 1 });
  });

  it("is not found without a score, for someone else's, or for an id that isn't a uuid", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    expect((await latest(uid, exerciseId)).status).toBe(404);

    await addScores(uid, exerciseId, 0);
    const other = newUid();
    await createUser(other);
    expect((await latest(other, exerciseId)).status).toBe(404);
    expect((await latest(uid, "not-a-uuid")).status).toBe(404);
  });

  it("skips runs whose feedback has been let go", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    await addScores(uid, exerciseId, 0, 10);
    // The newest run (overall 1) without its feedback.
    const cleared = { rightNotesFeedback: Prisma.DbNull, rhythmFeedback: Prisma.DbNull };
    await prisma.practiceScore.updateMany({
      where: { userId: uid, overall: 1 },
      data: { ...cleared, intonationFeedback: Prisma.DbNull, toneFeedback: Prisma.DbNull },
    });

    expect((await latest(uid, exerciseId)).body).toMatchObject({ overall: 0 });

    await prisma.history.deleteMany({ where: { userId: uid } });
    // Marked by one prune, cleared by the next.
    await pruneFeedback(FEEDBACK_PER_EXERCISE, 0);
    await pruneFeedback(FEEDBACK_PER_EXERCISE, 0);
    expect((await latest(uid, exerciseId)).status).toBe(404);
  });
});

/** Each of the user's scores (oldest first), with whether it still has its feedback. */
async function scoresOf(userId: string, exerciseId: string) {
  const rows = await prisma.practiceScore.findMany({
    where: { userId, exerciseId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => {
    const feedback = [r.rightNotesFeedback, r.rhythmFeedback, r.intonationFeedback, r.toneFeedback];
    // All four go together.
    expect(new Set(feedback.map((f) => f === null)).size).toBe(1);
    return { overall: r.overall, feedback: feedback[0] !== null };
  });
}

/** Prunes as a later run would, the grace for orphaned feedback over. */
const pruneLater = () => pruneFeedback(FEEDBACK_PER_EXERCISE, 0);

/** Whether each of the user's runs of an exercise is marked as orphaned. */
async function marksOf(userId: string, exerciseId: string) {
  const rows = await prisma.practiceScore.findMany({
    where: { userId, exerciseId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.feedbackOrphanedAt !== null);
}

describe("pruneFeedback", () => {
  it("marks the runs of exercises in neither history nor the library, and clears them on a later run", async () => {
    const uid = newUid();
    const kept = await userWithExercise(uid, "history");
    const gone = randomUUID();
    await addScores(uid, kept, 0);
    await addScores(uid, gone, 0, 1);
    const saver = newUid();
    const saved = await userWithExercise(saver, "library");
    await addScores(saver, saved, 0);

    // The first run only marks them: the exercise may be on its way back.
    expect(await pruneLater()).toEqual({ cleared: 0, marked: 2 });
    expect(await scoresOf(uid, gone)).toEqual([
      { overall: 0, feedback: true },
      { overall: 1, feedback: true },
    ]);
    expect(await marksOf(uid, gone)).toEqual([true, true]);

    // A later one clears them, keeping the scores.
    expect(await pruneLater()).toEqual({ cleared: 2, marked: 0 });
    expect(await scoresOf(uid, gone)).toEqual([
      { overall: 0, feedback: false },
      { overall: 1, feedback: false },
    ]);
    expect(await marksOf(uid, gone)).toEqual([false, false]);
    const gonePart = await prisma.practiceScore.findFirstOrThrow({ where: { exerciseId: gone } });
    expect(gonePart).toMatchObject({ ...exerciseInfo, tempo: 92, rhythmScore: 68 });
    expect(await scoresOf(uid, kept)).toEqual([{ overall: 0, feedback: true }]);
    expect(await scoresOf(saver, saved)).toEqual([{ overall: 0, feedback: true }]);
  });

  it("takes the mark off a run whose exercise is back by the next run", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    await addScores(uid, exerciseId, 0);
    const row = await prisma.history.findFirstOrThrow({ where: { userId: uid } });
    await prisma.history.deleteMany({ where: { userId: uid } });

    expect(await pruneLater()).toEqual({ cleared: 0, marked: 1 });
    // History cleared, and the exercise saved again.
    await prisma.history.create({ data: { ...row, id: undefined } });

    expect(await pruneLater()).toEqual({ cleared: 0, marked: 0 });
    expect(await scoresOf(uid, exerciseId)).toEqual([{ overall: 0, feedback: true }]);
    expect(await marksOf(uid, exerciseId)).toEqual([false]);
  });

  it("waits out the grace before clearing a marked run", async () => {
    const uid = newUid();
    await createUser(uid);
    const gone = randomUUID();
    await addScores(uid, gone, 0);

    expect(await pruneFeedback()).toEqual({ cleared: 0, marked: 1 });
    // Straight after, as two servers' prunes could be: not yet.
    expect(await pruneFeedback()).toEqual({ cleared: 0, marked: 0 });
    expect(await scoresOf(uid, gone)).toEqual([{ overall: 0, feedback: true }]);
  });

  it("keeps feedback only where the same user has the exercise", async () => {
    const owner = newUid();
    const exerciseId = await userWithExercise(owner);
    const other = newUid();
    await createUser(other);
    await addScores(other, exerciseId, 0);

    await pruneLater();
    expect(await pruneLater()).toEqual({ cleared: 1, marked: 0 });
    expect(await scoresOf(other, exerciseId)).toEqual([{ overall: 0, feedback: false }]);
  });

  it("keeps the feedback of each exercise's newest runs, up to the limit", async () => {
    const uid = newUid();
    const first = await userWithExercise(uid);
    const second = randomUUID();
    await prisma.history.create({ data: exerciseRow(uid, second, 2) });
    await addScores(uid, first, 0, 1, 2, 3);
    await addScores(uid, second, 0, 1);

    expect(await pruneFeedback(2)).toEqual({ cleared: 2, marked: 0 });
    // The rows added at 0 and 1 minutes lose their feedback; all four keep their scores.
    expect(await scoresOf(uid, first)).toEqual([
      { overall: 0, feedback: false },
      { overall: 1, feedback: false },
      { overall: 2, feedback: true },
      { overall: 3, feedback: true },
    ]);
    expect((await scoresOf(uid, second)).every((r) => r.feedback)).toBe(true);
  });

  it("leaves cleared rows alone on the next run", async () => {
    const uid = newUid();
    await createUser(uid);
    await addScores(uid, randomUUID(), 0);

    await pruneLater();
    expect(await pruneLater()).toEqual({ cleared: 1, marked: 0 });
    expect(await pruneLater()).toEqual({ cleared: 0, marked: 0 });
  });

  it("keeps the feedback of the exercise kept through a history clear", async () => {
    const uid = newUid();
    const exerciseId = await userWithExercise(uid);
    await addScores(uid, exerciseId, 0);
    const {
      userId: _,
      id: __,
      generationNum: ___,
      createdAt: ____,
      ...keep
    } = await prisma.history.findFirstOrThrow({ where: { userId: uid } });

    const res = await request(app).delete("/api/history").set(bearer(uid)).send({ keep });
    expect(res.status).toBe(200);
    await pruneLater();
    await pruneLater();

    expect(await scoresOf(uid, exerciseId)).toEqual([{ overall: 0, feedback: true }]);
  });
});
