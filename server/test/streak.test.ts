import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { googleClaims, tokenFor } from "./firebaseMock.js";
import { createUser, newUid } from "./helpers.js";

const bearer = (uid: string) => ({ Authorization: `Bearer ${tokenFor(googleClaims(uid))}` });

const DAY = 24 * 60 * 60 * 1000;

/** `hour`:00 UTC, `daysAgo` UTC days back. */
const daysAgo = (days: number, hour = 12) => {
  const date = new Date(Date.now() - days * DAY);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const ymd = (date: Date) => date.toISOString().slice(0, 10);

/** A scored run of a new exercise (or `exerciseId`), saved at `createdAt`. */
const run = (userId: string, createdAt: Date, exerciseId = randomUUID()) => ({
  userId,
  exerciseId,
  exerciseType: "RANDOM" as const,
  timeSig: "4/4",
  musicKey: "C major",
  noteRange: "MED" as const,
  difficulty: "LOW" as const,
  tempo: 90,
  overall: 80,
  rightNotesScore: 80,
  rhythmScore: 80,
  intonationScore: 80,
  toneScore: 80,
  createdAt,
});

/** A user who played on each of these UTC days back. */
async function playedOn(...days: number[]) {
  const uid = newUid();
  await createUser(uid);
  await prisma.practiceScore.createMany({ data: days.map((d) => run(uid, daysAgo(d))) });
  return uid;
}

const streak = (uid: string, tz = "UTC") =>
  request(app).get("/api/profile/streak").query({ tz }).set(bearer(uid));

describe("GET /api/profile/streak", () => {
  it("is nothing for someone who hasn't played", async () => {
    const res = await streak(newUid());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ current: 0, longest: 0, week: [] });
  });

  it("counts the days in a row up to today, and the longest run ever", async () => {
    const uid = await playedOn(0, 1, 2, 10, 11, 12, 13, 14, 20);
    const { current, longest } = (await streak(uid)).body;
    expect(current).toBe(3);
    expect(longest).toBe(5);
  });

  it("keeps the streak going while today has nothing yet", async () => {
    const uid = await playedOn(1, 2);
    expect((await streak(uid)).body).toMatchObject({ current: 2, longest: 2 });
  });

  it("ends it once a whole day goes by without play", async () => {
    const uid = await playedOn(2, 3, 4);
    expect((await streak(uid)).body).toMatchObject({ current: 0, longest: 3 });
  });

  it("counts a day once, however much was played on it", async () => {
    const uid = await playedOn(0, 0, 0, 1);
    const exercise = randomUUID();
    await prisma.practiceScore.createMany({
      data: [run(uid, daysAgo(1, 8), exercise), run(uid, daysAgo(1, 9), exercise)],
    });
    expect((await streak(uid)).body).toMatchObject({ current: 2, longest: 2 });
  });

  it("lists the days played this week, from Monday", async () => {
    const weekday = (new Date().getUTCDay() + 6) % 7; // Monday 0
    // Every day this week so far, last Sunday, and the Saturday before missed.
    const days = Array.from({ length: weekday + 2 }, (_, i) => i);
    const uid = await playedOn(...days);
    const { current, week } = (await streak(uid)).body;
    expect(current).toBe(weekday + 2);
    expect(week).toEqual(Array.from({ length: weekday + 1 }, (_, i) => ymd(daysAgo(weekday - i))));
  });

  it("counts days in the time zone asked for", async () => {
    // 23:00 and 01:00 UTC: two days in a row in UTC, one morning in Tokyo (UTC+9).
    const uid = newUid();
    await createUser(uid);
    await prisma.practiceScore.createMany({
      data: [run(uid, daysAgo(11, 23)), run(uid, daysAgo(10, 1))],
    });
    expect((await streak(uid)).body.longest).toBe(2);
    expect((await streak(uid, "Asia/Tokyo")).body.longest).toBe(1);
  });

  it.each(["+05:00", "Not/A_Zone", "UTC'; DROP TABLE users; --"])(
    "turns down the time zone %j",
    async (tz) => {
      const res = await streak(newUid(), tz);
      expect(res.status).toBe(400);
    },
  );

  it("needs a signed-in user", async () => {
    expect((await request(app).get("/api/profile/streak")).status).toBe(401);
  });
});
