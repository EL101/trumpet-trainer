import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { HISTORY_LIMIT, deleteHistoryDuplicates, pruneHistory } from "../src/queries/exercises.js";
import { googleClaims, tokenFor } from "./firebaseMock.js";
import { addHistory, addLibrary, createUser, exerciseBody, newUid } from "./helpers.js";

const bearer = (uid: string) => ({ Authorization: `Bearer ${tokenFor(googleClaims(uid))}` });

/** 1, 2, …, n */
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const historyGenerations = async (userId: string) =>
  (await prisma.history.findMany({ where: { userId }, orderBy: { generationNum: "asc" } })).map(
    (row) => row.generationNum,
  );

describe.each(["history", "library"] as const)("POST /api/%s exercise type", (table) => {
  const post = (uid: string, body: object) =>
    request(app).post(`/api/${table}`).set(bearer(uid)).send(body);

  it("stores the type sent", async () => {
    const uid = newUid();
    const res = await post(uid, { ...exerciseBody(), exerciseType: "LIP_SLURS" });

    expect(res.status).toBe(201);
    expect(res.body.exerciseType).toBe("LIP_SLURS");
  });

  it("rejects a type outside the enum", async () => {
    const uid = newUid();
    const res = await post(uid, { ...exerciseBody(), exerciseType: "SIGHT_READING" });

    expect(res.status).toBe(400);
    expect(await (prisma[table] as typeof prisma.history).count({ where: { userId: uid } })).toBe(
      0,
    );
  });

  it("takes a missing type as RANDOM, as clients from before the column send", async () => {
    const uid = newUid();
    const res = await post(uid, exerciseBody());

    expect(res.status).toBe(201);
    expect(res.body.exerciseType).toBe("RANDOM");
  });
});

describe("exercise_type column", () => {
  it("is enforced by the database too", async () => {
    const uid = newUid();
    await createUser(uid);

    await expect(
      prisma.$executeRaw`
        INSERT INTO history (id, user_id, exercise_type, notes, time_sig, music_key, note_range, difficulty, generation_num)
        VALUES (gen_random_uuid(), ${uid}, 'SIGHT_READING', 'C4/w', '4/4', 'C major', 'MED', 'LOW', 1)`,
    ).rejects.toThrow(/invalid input value for enum exercise_type/);
  });
});

describe("GET /api/history", () => {
  it(`returns only the newest ${HISTORY_LIMIT}, newest first`, async () => {
    const uid = newUid();
    await createUser(uid);
    await addHistory(uid, ...upTo(HISTORY_LIMIT + 5));

    const res = await request(app).get("/api/history").set(bearer(uid));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(HISTORY_LIMIT);
    expect(res.body[0].generationNum).toBe(HISTORY_LIMIT + 5);
    expect(res.body.at(-1).generationNum).toBe(6);
  });
});

describe("saving a generation twice", () => {
  const post = (table: "history" | "library", uid: string, body: object) =>
    request(app).post(`/api/${table}`).set(bearer(uid)).send(body);

  it("keeps the first history save and answers the second with it", async () => {
    const uid = newUid();
    const first = await post("history", uid, { ...exerciseBody(1), notes: "C4/w" });
    const again = await post("history", uid, { ...exerciseBody(1), notes: "G4/w" });

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: first.body.id, notes: "C4/w" });
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(1);
  });

  it("still adds a second library row", async () => {
    const uid = newUid();
    expect((await post("library", uid, exerciseBody(1))).status).toBe(201);
    expect((await post("library", uid, exerciseBody(1))).status).toBe(201);
    expect(await prisma.library.count({ where: { userId: uid } })).toBe(2);
  });

  it("is refused by the database too, per user", async () => {
    const a = newUid();
    const b = newUid();
    await createUser(a);
    await createUser(b);
    await addHistory(a, 1);

    await expect(addHistory(a, 1)).rejects.toThrow(/Unique constraint/);
    await expect(addHistory(b, 1)).resolves.toEqual({ count: 1 });
  });
});

describe("pruneHistory", () => {
  it(`keeps each user's newest ${HISTORY_LIMIT} and deletes the rest`, async () => {
    const over = newUid();
    const under = newUid();
    await createUser(over);
    await createUser(under);
    await addHistory(over, ...upTo(HISTORY_LIMIT + 3));
    await addHistory(under, ...upTo(50));

    expect(await pruneHistory()).toBe(3);
    expect(await historyGenerations(over)).toEqual(upTo(HISTORY_LIMIT + 3).slice(3));
    expect(await historyGenerations(under)).toEqual(upTo(50));
  });

  it("leaves the library alone", async () => {
    const uid = newUid();
    await createUser(uid);
    await addLibrary(uid, ...upTo(HISTORY_LIMIT + 10));

    expect(await pruneHistory()).toBe(0);
    expect(await prisma.library.count({ where: { userId: uid } })).toBe(HISTORY_LIMIT + 10);
  });

  it("works through a large excess in batches", async () => {
    const a = newUid();
    const b = newUid();
    await createUser(a);
    await createUser(b);
    await addHistory(a, ...upTo(12));
    await addHistory(b, ...upTo(9));

    // Limit 5, two rows per batch: a needs four rounds, b two.
    expect(await pruneHistory(5, 2)).toBe(11);
    expect(await historyGenerations(a)).toEqual([8, 9, 10, 11, 12]);
    expect(await historyGenerations(b)).toEqual([5, 6, 7, 8, 9]);
  });

  it("does nothing when everyone is within the limit", async () => {
    const uid = newUid();
    await createUser(uid);
    await addHistory(uid, ...upTo(HISTORY_LIMIT));

    expect(await pruneHistory()).toBe(0);
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(HISTORY_LIMIT);
  });
});
