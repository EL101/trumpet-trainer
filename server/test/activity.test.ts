import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { googleClaims, tokenFor } from "./firebaseMock.js";
import { createUser, newUid } from "./helpers.js";

const bearer = (uid: string) => ({ Authorization: `Bearer ${tokenFor(googleClaims(uid))}` });

const DAY = 24 * 60 * 60 * 1000;

/** 03:00 UTC, `daysAgo` days back: still the day before in the Americas. */
const at3am = (daysAgo: number) => {
  const date = new Date(Date.now() - daysAgo * DAY);
  date.setUTCHours(3, 0, 0, 0);
  return date;
};

const ymd = (date: Date) => date.toISOString().slice(0, 10);

/** A scored run of `exerciseId`, saved at `createdAt`. */
const run = (userId: string, exerciseId: string, createdAt: Date) => ({
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

const activity = (uid: string, tz?: string, year?: number) =>
  request(app)
    .get("/api/profile/activity")
    .query({ ...(tz && { tz }), ...(year && { year }) })
    .set(bearer(uid));

/** Noon UTC on a date: the same date anywhere from UTC−11 to UTC+11. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`);

describe("GET /api/profile/activity", () => {
  it("counts the different exercises played each day, replays once", async () => {
    const uid = newUid();
    const other = newUid();
    await createUser(uid);
    await createUser(other);
    const [a, b] = [randomUUID(), randomUUID()];
    const day1 = at3am(5);
    const day2 = at3am(2);
    await prisma.practiceScore.createMany({
      data: [
        run(uid, a, day1),
        run(uid, a, new Date(day1.getTime() + 60_000)),
        run(uid, b, new Date(day1.getTime() + 120_000)),
        run(uid, a, day2),
        run(other, a, day2),
      ],
    });

    const res = await activity(uid);

    expect(res.status).toBe(200);
    expect(res.body.days).toEqual([
      { date: ymd(day1), played: 2 },
      { date: ymd(day2), played: 1 },
    ]);
  });

  it("counts days in the time zone it's given", async () => {
    const uid = newUid();
    await createUser(uid);
    const when = at3am(3);
    await prisma.practiceScore.create({ data: run(uid, randomUUID(), when) });

    const dayBefore = ymd(new Date(when.getTime() - DAY));
    expect((await activity(uid, "America/Los_Angeles")).body.days).toEqual([
      { date: dayBefore, played: 1 },
    ]);
    expect((await activity(uid, "Asia/Tokyo")).body.days).toEqual([{ date: ymd(when), played: 1 }]);
    expect((await activity(uid)).body.days).toEqual([{ date: ymd(when), played: 1 }]);
  });

  it("leaves out runs from before the grid's year", async () => {
    const uid = newUid();
    await createUser(uid);
    await prisma.practiceScore.create({ data: run(uid, randomUUID(), at3am(400)) });
    const res = await activity(uid);
    expect(res.body.days).toEqual([]);
    expect(res.body.years).toEqual([at3am(400).getUTCFullYear()]);
  });

  it("shows a calendar year when asked, and lists the years played in", async () => {
    const uid = newUid();
    await createUser(uid);
    const ex = randomUUID();
    await prisma.practiceScore.createMany({
      data: [
        run(uid, ex, noon("2023-06-01")),
        run(uid, ex, noon("2024-01-01")),
        run(uid, randomUUID(), noon("2024-01-01")),
        run(uid, ex, noon("2024-12-31")),
        run(uid, ex, noon("2025-01-01")),
      ],
    });

    const res = await activity(uid, undefined, 2024);

    expect(res.status).toBe(200);
    expect(res.body.days).toEqual([
      { date: "2024-01-01", played: 2 },
      { date: "2024-12-31", played: 1 },
    ]);
    expect(res.body.years).toEqual([2025, 2024, 2023]);
  });

  it("finds a year's edges in the time zone it's given", async () => {
    const uid = newUid();
    await createUser(uid);
    // 1 January 2025 at 03:00 UTC: still New Year's Eve 2024 in Los Angeles.
    await prisma.practiceScore.create({
      data: run(uid, randomUUID(), new Date("2025-01-01T03:00:00Z")),
    });

    const la = await activity(uid, "America/Los_Angeles", 2024);
    expect(la.body).toEqual({ days: [{ date: "2024-12-31", played: 1 }], years: [2024] });
    expect((await activity(uid, "America/Los_Angeles", 2025)).body.days).toEqual([]);
    expect((await activity(uid, "UTC", 2025)).body).toEqual({
      days: [{ date: "2025-01-01", played: 1 }],
      years: [2025],
    });
  });

  it.each(["1999", "20x5", "2025.5"])("turns down %j as a year", async (year) => {
    const res = await request(app)
      .get("/api/profile/activity")
      .query({ year })
      .set(bearer(newUid()));
    expect(res.status).toBe(400);
  });

  it.each(["+05:00", "Not/A_Zone", "UTC; DROP TABLE users", ""])(
    "turns down %j as a time zone",
    async (tz) => {
      const res = await request(app)
        .get("/api/profile/activity")
        .query({ tz })
        .set(bearer(newUid()));
      expect(res.status).toBe(400);
    },
  );

  it("needs a signed-in user", async () => {
    expect((await request(app).get("/api/profile/activity")).status).toBe(401);
  });
});
