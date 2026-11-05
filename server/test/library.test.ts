import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import type { ExerciseType } from "../src/generated/prisma/enums.js";
import { googleClaims, tokenFor } from "./firebaseMock.js";
import { createUser, newUid } from "./helpers.js";

const bearer = (uid: string) => ({ Authorization: `Bearer ${tokenFor(googleClaims(uid))}` });

type Saved = {
  generationNum: number;
  exerciseType?: ExerciseType;
  musicKey?: string;
  timeSig?: string;
  /** Minutes after the first save. */
  at?: number;
};

/** Saves exercises straight to the library, each `at` minutes in (by default its index). */
async function saveAll(userId: string, saved: Saved[]) {
  await createUser(userId);
  const start = Date.UTC(2026, 0, 1);
  const rows = saved.map(({ at, ...row }, i) => ({
    userId,
    exerciseId: randomUUID(),
    exerciseType: "SCALES" as const,
    notes: "C4/w",
    timeSig: "4/4",
    musicKey: "C major",
    noteRange: "MED",
    difficulty: "LOW",
    createdAt: new Date(start + (at ?? i) * 60_000),
    ...row,
  }));
  await prisma.library.createMany({ data: rows });
  return rows;
}

const page = (uid: string, query: Record<string, string | number> = {}) =>
  request(app).get("/api/library/page").query(query).set(bearer(uid));

/** The generation numbers a page lists, in order. */
const numbers = (res: request.Response) =>
  (res.body.entries as { generationNum: number }[]).map((e) => e.generationNum);

describe("GET /api/library/page", () => {
  it("pages through newest saved first, following on from the last entry", async () => {
    const uid = newUid();
    const rows = await saveAll(
      uid,
      [1, 2, 3, 4, 5].map((n) => ({ generationNum: n })),
    );

    const first = await page(uid, { limit: 2 });
    expect(first.status).toBe(200);
    expect(numbers(first)).toEqual([5, 4]);
    expect(first.body).toMatchObject({ total: 5, hasMore: true });

    const second = await page(uid, { limit: 2, after: rows[3].exerciseId });
    expect(numbers(second)).toEqual([3, 2]);
    expect(second.body.hasMore).toBe(true);

    const last = await page(uid, { limit: 2, after: rows[1].exerciseId });
    expect(numbers(last)).toEqual([1]);
    expect(last.body).toMatchObject({ total: 5, hasMore: false });
  });

  it("neither skips nor repeats entries saved at the same moment", async () => {
    const uid = newUid();
    const rows = await saveAll(
      uid,
      [1, 2, 3, 4, 5].map((n) => ({ generationNum: n, at: 0 })),
    );
    const seen: number[] = [];
    let after: string | undefined;
    for (;;) {
      const res = await page(uid, { limit: 2, ...(after && { after }) });
      seen.push(...numbers(res));
      if (!res.body.hasMore) break;
      after = res.body.entries.at(-1).exerciseId;
    }
    expect(seen.toSorted()).toEqual(rows.map((r) => r.generationNum));
  });

  it("follows on correctly after earlier entries are removed", async () => {
    const uid = newUid();
    const rows = await saveAll(
      uid,
      [1, 2, 3, 4, 5].map((n) => ({ generationNum: n })),
    );
    await prisma.library.deleteMany({ where: { exerciseId: rows[4].exerciseId } });

    const res = await page(uid, { limit: 2, after: rows[3].exerciseId });
    expect(numbers(res)).toEqual([3, 2]);
    expect(res.body.total).toBe(4);
  });

  it("is not found when the entry to follow on from has gone", async () => {
    const uid = newUid();
    const rows = await saveAll(uid, [{ generationNum: 1 }, { generationNum: 2 }]);
    await prisma.library.deleteMany({ where: { exerciseId: rows[1].exerciseId } });

    expect((await page(uid, { after: rows[1].exerciseId })).status).toBe(404);
  });

  it("is not found following on from another user's entry", async () => {
    const [rows] = [await saveAll(newUid(), [{ generationNum: 1 }])];
    const uid = newUid();
    await saveAll(uid, [{ generationNum: 2 }]);
    expect((await page(uid, { after: rows[0].exerciseId })).status).toBe(404);
  });

  it("lists only the caller's entries", async () => {
    const uid = newUid();
    await saveAll(uid, [{ generationNum: 1 }]);
    await saveAll(newUid(), [{ generationNum: 2 }]);
    const res = await page(uid);
    expect(numbers(res)).toEqual([1]);
    expect(res.body.total).toBe(1);
  });

  it("is empty for an empty library", async () => {
    const uid = newUid();
    await createUser(uid);
    expect((await page(uid)).body).toEqual({ entries: [], total: 0, hasMore: false });
  });

  it("filters by type, counting only that type", async () => {
    const uid = newUid();
    const rows = await saveAll(uid, [
      { generationNum: 1, exerciseType: "LONG_TONES" },
      { generationNum: 2 },
      { generationNum: 3, exerciseType: "LONG_TONES" },
      { generationNum: 4 },
      { generationNum: 5, exerciseType: "LONG_TONES" },
    ]);
    const first = await page(uid, { type: "LONG_TONES", limit: 2 });
    expect(numbers(first)).toEqual([5, 3]);
    expect(first.body).toMatchObject({ total: 3, hasMore: true });

    const next = await page(uid, { type: "LONG_TONES", limit: 2, after: rows[2].exerciseId });
    expect(numbers(next)).toEqual([1]);
  });

  describe("search", () => {
    const library: Saved[] = [
      { generationNum: 42, musicKey: "Bb minor" },
      { generationNum: 7, exerciseType: "LONG_TONES", musicKey: "G major", timeSig: "3/4" },
      { generationNum: 12, exerciseType: "LIP_SLURS", musicKey: "C major" },
      { generationNum: 420, musicKey: "F# minor" },
    ];
    const search = async (q: string, type?: ExerciseType) => {
      const uid = newUid();
      await saveAll(uid, library);
      const res = await page(uid, { q, ...(type && { type }) });
      expect(res.status).toBe(200);
      return numbers(res).toSorted((a, b) => a - b);
    };

    it("lists everything for a blank search", async () => {
      expect(await search("   ")).toEqual([7, 12, 42, 420]);
    });

    it("finds a key written with b/# or ♭/♯, in any word order", async () => {
      expect(await search("bb minor")).toEqual([42]);
      expect(await search("minor B♭")).toEqual([42]);
      expect(await search("f♯")).toEqual([420]);
    });

    it("finds an exercise by its type, number or time signature", async () => {
      expect(await search("long")).toEqual([7]);
      expect(await search("No. 42")).toEqual([42]);
      expect(await search("3/4")).toEqual([7]);
    });

    it("matches a number exactly, not as part of a longer one", async () => {
      expect(await search("42")).toEqual([42]);
    });

    it("doesn't find lip slurs by the C major they're stored in", async () => {
      expect(await search("c major")).toEqual([]);
    });

    it("needs every word to match, within the chosen type", async () => {
      expect(await search("scales g")).toEqual([]);
      expect(await search("long", "SCALES")).toEqual([]);
    });

    it("takes % and _ literally", async () => {
      expect(await search("%")).toEqual([]);
      expect(await search("_")).toEqual([]);
      expect(await search("\\")).toEqual([]);
    });
  });

  it("turns down a bad limit, cursor or type", async () => {
    const uid = newUid();
    for (const query of [{ limit: 0 }, { limit: 101 }, { after: "nope" }, { type: "SAVED" }]) {
      expect((await page(uid, query)).status).toBe(400);
    }
  });

  it("needs a signed-in user", async () => {
    expect((await request(app).get("/api/library/page")).status).toBe(401);
  });
});
