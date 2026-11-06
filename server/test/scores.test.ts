import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { pruneFeedback } from "../src/queries/scores.js";
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
    await pruneFeedback();
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

describe("pruneFeedback", () => {
  it("clears the feedback of exercises in neither history nor the library, keeping the scores", async () => {
    const uid = newUid();
    const kept = await userWithExercise(uid, "history");
    const gone = randomUUID();
    await addScores(uid, kept, 0);
    await addScores(uid, gone, 0, 1);
    const saver = newUid();
    const saved = await userWithExercise(saver, "library");
    await addScores(saver, saved, 0);

    expect(await pruneFeedback()).toBe(2);
    expect(await scoresOf(uid, gone)).toEqual([
      { overall: 0, feedback: false },
      { overall: 1, feedback: false },
    ]);
    const gonePart = await prisma.practiceScore.findFirstOrThrow({ where: { exerciseId: gone } });
    expect(gonePart).toMatchObject({ ...exerciseInfo, tempo: 92, rhythmScore: 68 });
    expect(await scoresOf(uid, kept)).toEqual([{ overall: 0, feedback: true }]);
    expect(await scoresOf(saver, saved)).toEqual([{ overall: 0, feedback: true }]);
  });

  it("keeps feedback only where the same user has the exercise", async () => {
    const owner = newUid();
    const exerciseId = await userWithExercise(owner);
    const other = newUid();
    await createUser(other);
    await addScores(other, exerciseId, 0);

    expect(await pruneFeedback()).toBe(1);
    expect(await scoresOf(other, exerciseId)).toEqual([{ overall: 0, feedback: false }]);
  });

  it("keeps the feedback of each exercise's newest runs, up to the limit", async () => {
    const uid = newUid();
    const first = await userWithExercise(uid);
    const second = randomUUID();
    await prisma.history.create({ data: exerciseRow(uid, second, 2) });
    await addScores(uid, first, 0, 1, 2, 3);
    await addScores(uid, second, 0, 1);

    expect(await pruneFeedback(2)).toBe(2);
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

    expect(await pruneFeedback()).toBe(1);
    expect(await pruneFeedback()).toBe(0);
  });
});
