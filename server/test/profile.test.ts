import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { AVATAR_MAX_BYTES } from "../src/avatar.js";
import { setAvatar } from "../src/queries/avatars.js";
import { spendTodayMicros } from "../src/queries/etudes.js";
import { auth, firebaseError, googleClaims, guestClaims, tokenFor } from "./firebaseMock.js";
import { JPEG, PNG, addHistory, addLibrary, createUser, dataUrl, newUid } from "./helpers.js";

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("GET /api/profile", () => {
  it("returns the caller's profile", async () => {
    const uid = newUid();
    const res = await request(app)
      .get("/api/profile")
      .set(bearer(tokenFor(googleClaims(uid, { email: "a@b.com", name: "Ann" }))));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: uid,
      email: "a@b.com",
      displayName: "Ann",
      isAnonymous: false,
      avatarUrl: null,
      hasUpload: false,
      createdAt: expect.any(String),
    });
  });

  it("falls back to the provider photo when nothing is uploaded", async () => {
    const claims = googleClaims(newUid(), { picture: "https://photos.example/me.jpg" });
    const res = await request(app)
      .get("/api/profile")
      .set(bearer(tokenFor(claims)));
    expect(res.body).toMatchObject({
      avatarUrl: "https://photos.example/me.jpg",
      hasUpload: false,
    });
  });

  it("prefers an uploaded avatar over the provider photo", async () => {
    const uid = newUid();
    await createUser(uid);
    await setAvatar(uid, "image/png", PNG);

    const claims = googleClaims(uid, { picture: "https://photos.example/me.jpg" });
    const res = await request(app)
      .get("/api/profile")
      .set(bearer(tokenFor(claims)));
    expect(res.body).toMatchObject({ avatarUrl: dataUrl(PNG), hasUpload: true });
  });
});

describe("PUT /api/profile/avatar", () => {
  const upload = (token: string, body: object) =>
    request(app).put("/api/profile/avatar").set(bearer(token)).send(body);

  it("stores the image and returns it", async () => {
    const uid = newUid();
    const res = await upload(tokenFor(googleClaims(uid)), { dataUrl: dataUrl(PNG) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avatarUrl: dataUrl(PNG), hasUpload: true });
    const row = await prisma.userAvatar.findUniqueOrThrow({ where: { userId: uid } });
    expect(row.mimeType).toBe("image/png");
  });

  it("replaces an existing upload", async () => {
    const uid = newUid();
    const token = tokenFor(googleClaims(uid));
    await upload(token, { dataUrl: dataUrl(PNG) });
    await upload(token, { dataUrl: dataUrl(JPEG, "image/jpeg") });

    const rows = await prisma.userAvatar.findMany({ where: { userId: uid } });
    expect(rows).toHaveLength(1);
    expect(rows[0].mimeType).toBe("image/jpeg");
  });

  it("refuses uploads from guests", async () => {
    const uid = newUid("guest");
    const res = await upload(tokenFor(guestClaims(uid)), { dataUrl: dataUrl(PNG) });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Sign in to upload a profile picture");
    expect(await prisma.userAvatar.count({ where: { userId: uid } })).toBe(0);
  });

  it("rejects a missing body field", async () => {
    const res = await upload(tokenFor(googleClaims(newUid())), {});
    expect(res.status).toBe(400);
  });

  it("rejects bytes that aren't a supported image", async () => {
    const res = await upload(tokenFor(googleClaims(newUid())), {
      dataUrl: dataUrl(Buffer.from("<svg/>"), "image/svg+xml"),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PNG, JPEG and WebP/);
  });

  it("accepts a max-size image, which is larger than the default JSON body limit", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES - PNG.length)]);
    const res = await upload(tokenFor(googleClaims(newUid())), { dataUrl: dataUrl(big) });
    expect(res.status).toBe(200);
  });

  it("only allows the larger body limit on the avatar route", async () => {
    const res = await request(app)
      .post("/api/profile/sync")
      .set(bearer(tokenFor(googleClaims(newUid()))))
      .send({ padding: "x".repeat(200 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe("DELETE /api/profile/avatar", () => {
  it("removes the upload", async () => {
    const uid = newUid();
    await createUser(uid);
    await setAvatar(uid, "image/png", PNG);

    const res = await request(app)
      .delete("/api/profile/avatar")
      .set(bearer(tokenFor(googleClaims(uid))));
    expect(res.status).toBe(204);
    expect(await prisma.userAvatar.count({ where: { userId: uid } })).toBe(0);
  });

  it("succeeds when there is nothing to remove", async () => {
    const res = await request(app)
      .delete("/api/profile/avatar")
      .set(bearer(tokenFor(googleClaims(newUid()))));
    expect(res.status).toBe(204);
  });
});

describe("POST /api/profile/sync", () => {
  it("turns a guest row into a real profile after linking", async () => {
    const uid = newUid();
    await request(app)
      .get("/api/profile")
      .set(bearer(tokenFor(guestClaims(uid))));

    const res = await request(app)
      .post("/api/profile/sync")
      .set(bearer(tokenFor(googleClaims(uid, { email: "new@b.com", name: "New" }))));

    expect(res.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    expect(row).toMatchObject({ email: "new@b.com", displayName: "New", isAnonymous: false });
  });
});

describe("POST /api/profile/merge-guest", () => {
  const merge = (callerToken: string, guestToken: string) =>
    request(app).post("/api/profile/merge-guest").set(bearer(callerToken)).send({ guestToken });

  it("moves the guest's exercises to the caller and deletes the guest", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await addHistory(guest, 1, 2);
    await addLibrary(guest, 1);

    const res = await merge(tokenFor(googleClaims(target)), tokenFor(guestClaims(guest)));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ history: 2, library: 1 });
    expect(await prisma.history.count({ where: { userId: target } })).toBe(2);
    expect(await prisma.library.count({ where: { userId: target } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: guest } })).toBeNull();
    expect(auth.deleteUser).toHaveBeenCalledWith(guest);
  });

  it("brings the guest's scores, generated count and settings along", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await prisma.user.update({ where: { id: guest }, data: { exercisesGenerated: 4 } });
    await prisma.user.update({ where: { id: target }, data: { exercisesGenerated: 10 } });
    const ranges = { lowMin: 54, lowMax: 74, medMin: 62, medMax: 81, highMin: 72, highMax: 88 };
    await prisma.userSettings.create({ data: { userId: guest, ...ranges } });
    await prisma.practiceScore.create({
      data: {
        userId: guest,
        exerciseId: crypto.randomUUID(),
        exerciseType: "RANDOM",
        timeSig: "4/4",
        musicKey: "C major",
        noteRange: "MED",
        difficulty: "LOW",
        tempo: 90,
        overall: 80,
        rightNotesScore: 80,
        rhythmScore: 80,
        intonationScore: 80,
        toneScore: 80,
      },
    });

    const res = await merge(tokenFor(googleClaims(target)), tokenFor(guestClaims(guest)));

    expect(res.status).toBe(200);
    expect(await prisma.practiceScore.count({ where: { userId: target } })).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: target } });
    expect(user.exercisesGenerated).toBe(14);
    expect(await prisma.userSettings.findUnique({ where: { userId: target } })).toMatchObject(
      ranges,
    );
  });

  it("keeps the account's own settings over the guest's", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    const ranges = { lowMin: 54, lowMax: 72, medMin: 60, medMax: 84, highMin: 72 };
    await prisma.userSettings.create({ data: { userId: guest, ...ranges, highMax: 88 } });
    await prisma.userSettings.create({ data: { userId: target, ...ranges, highMax: 86 } });

    await merge(tokenFor(googleClaims(target)), tokenFor(guestClaims(guest)));

    const kept = await prisma.userSettings.findUniqueOrThrow({ where: { userId: target } });
    expect(kept.highMax).toBe(86);
  });

  it("refuses to merge from an account that isn't a guest", async () => {
    const victim = newUid("victim");
    await createUser(victim);
    await addHistory(victim, 1);

    const res = await merge(tokenFor(googleClaims(newUid())), tokenFor(googleClaims(victim)));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Not a guest account");
    expect(await prisma.history.count({ where: { userId: victim } })).toBe(1);
  });

  it("refuses to merge an account into itself", async () => {
    const uid = newUid();
    const res = await merge(tokenFor(guestClaims(uid)), tokenFor(guestClaims(uid)));
    expect(res.status).toBe(400);
  });

  it("rejects a guest token that doesn't verify", async () => {
    const res = await merge(tokenFor(googleClaims(newUid())), "forged");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid guest token");
  });

  it("rejects a missing guest token", async () => {
    const res = await request(app)
      .post("/api/profile/merge-guest")
      .set(bearer(tokenFor(googleClaims(newUid()))))
      .send({});
    expect(res.status).toBe(400);
  });

  it("still succeeds when Firebase can't delete the guest", async () => {
    const guest = newUid("guest");
    await createUser(guest, { isAnonymous: true });
    auth.deleteUser.mockRejectedValueOnce(firebaseError("auth/internal-error"));

    const res = await merge(tokenFor(googleClaims(newUid())), tokenFor(guestClaims(guest)));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/profile/discard-guest", () => {
  const discard = (callerToken: string, guestToken: string) =>
    request(app).post("/api/profile/discard-guest").set(bearer(callerToken)).send({ guestToken });

  it("deletes the guest and its exercises, leaving the caller's alone", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await addHistory(guest, 1, 2);
    await addLibrary(guest, 1);
    await addHistory(target, 1);
    await setAvatar(guest, "image/png", PNG);

    const res = await discard(tokenFor(googleClaims(target)), tokenFor(guestClaims(guest)));

    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: guest } })).toBeNull();
    expect(await prisma.history.count({ where: { userId: guest } })).toBe(0);
    expect(await prisma.library.count({ where: { userId: guest } })).toBe(0);
    expect(await prisma.userAvatar.findUnique({ where: { userId: guest } })).toBeNull();
    expect(await prisma.history.count({ where: { userId: target } })).toBe(1);
    expect(auth.deleteUser).toHaveBeenCalledWith(guest);
  });

  it("refuses to discard an account that isn't a guest", async () => {
    const victim = newUid("victim");
    await createUser(victim);
    await addHistory(victim, 1);

    const res = await discard(tokenFor(googleClaims(newUid())), tokenFor(googleClaims(victim)));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Not a guest account");
    expect(await prisma.history.count({ where: { userId: victim } })).toBe(1);
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("refuses to discard the caller's own account", async () => {
    const uid = newUid();
    await createUser(uid, { isAnonymous: true });
    const res = await discard(tokenFor(guestClaims(uid)), tokenFor(guestClaims(uid)));
    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });

  it("rejects a guest token that doesn't verify", async () => {
    const res = await discard(tokenFor(googleClaims(newUid())), "forged");
    expect(res.status).toBe(401);
  });

  it("still succeeds when Firebase can't delete the guest", async () => {
    const guest = newUid("guest");
    await createUser(guest, { isAnonymous: true });
    auth.deleteUser.mockRejectedValueOnce(firebaseError("auth/internal-error"));

    const res = await discard(tokenFor(googleClaims(newUid())), tokenFor(guestClaims(guest)));
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: guest } })).toBeNull();
  });
});

describe("DELETE /api/profile", () => {
  /** A user owning one of everything, and the token to act as them. */
  async function userWithData() {
    const uid = newUid();
    const token = tokenFor(googleClaims(uid));
    await createUser(uid);
    await addHistory(uid, 1, 2);
    await addLibrary(uid, 1);
    await setAvatar(uid, "image/png", PNG);
    await prisma.userSettings.create({
      data: {
        userId: uid,
        lowMin: 54,
        lowMax: 72,
        medMin: 60,
        medMax: 84,
        highMin: 72,
        highMax: 91,
      },
    });
    await prisma.practiceScore.create({
      data: {
        userId: uid,
        exerciseId: "00000000-0000-4000-8000-000000000000",
        exerciseType: "RANDOM",
        timeSig: "4/4",
        musicKey: "C major",
        noteRange: "MED",
        difficulty: "LOW",
        tempo: 90,
        overall: 80,
        rightNotesScore: 80,
        rhythmScore: 80,
        intonationScore: 80,
        toneScore: 80,
      },
    });
    return { uid, token };
  }

  const owned = async (userId: string) => ({
    users: await prisma.user.count({ where: { id: userId } }),
    history: await prisma.history.count({ where: { userId } }),
    library: await prisma.library.count({ where: { userId } }),
    scores: await prisma.practiceScore.count({ where: { userId } }),
    avatars: await prisma.userAvatar.count({ where: { userId } }),
    settings: await prisma.userSettings.count({ where: { userId } }),
  });
  const nothing = { users: 0, history: 0, library: 0, scores: 0, avatars: 0, settings: 0 };

  it("deletes the caller's data and Firebase user, and no one else's", async () => {
    const me = await userWithData();
    const other = await userWithData();

    const res = await request(app).delete("/api/profile").set(bearer(me.token));

    expect(res.status).toBe(204);
    expect(await owned(me.uid)).toEqual(nothing);
    expect(auth.deleteUser).toHaveBeenCalledWith(me.uid);
    expect(auth.deleteUser).toHaveBeenCalledTimes(1);
    expect(await owned(other.uid)).toEqual({
      ...nothing,
      users: 1,
      history: 2,
      library: 1,
      scores: 1,
      avatars: 1,
      settings: 1,
    });
  });

  it("keeps what the caller's etudes cost, for the spend cap, with no user", async () => {
    const { uid, token } = await userWithData();
    const etude = await prisma.etudeGeneration.create({
      data: { userId: uid, model: "claude-haiku-5-5", status: "SUCCEEDED", costMicros: 40_000 },
    });
    const spent = await spendTodayMicros();

    expect((await request(app).delete("/api/profile").set(bearer(token))).status).toBe(204);

    expect(await prisma.etudeGeneration.findUnique({ where: { id: etude.id } })).toMatchObject({
      userId: null,
      costMicros: 40_000,
    });
    expect(await spendTodayMicros()).toBe(spent);
  });

  it("lets guests delete theirs", async () => {
    const uid = newUid("guest");
    const res = await request(app)
      .delete("/api/profile")
      .set(bearer(tokenFor(guestClaims(uid))));
    expect(res.status).toBe(204);
    expect(await prisma.user.count({ where: { id: uid } })).toBe(0);
    expect(auth.deleteUser).toHaveBeenCalledWith(uid);
  });

  it("is done if the Firebase user is already gone", async () => {
    const { token } = await userWithData();
    auth.deleteUser.mockRejectedValueOnce(firebaseError("auth/user-not-found"));
    expect((await request(app).delete("/api/profile").set(bearer(token))).status).toBe(204);
  });

  it("fails if Firebase can't delete the user, with the data gone, and a retry finishes", async () => {
    const { uid, token } = await userWithData();
    auth.deleteUser.mockRejectedValueOnce(firebaseError("auth/internal-error"));

    const res = await request(app).delete("/api/profile").set(bearer(token));
    expect(res.status).toBe(500);
    expect(await owned(uid)).toEqual(nothing);

    const retry = await request(app).delete("/api/profile").set(bearer(token));
    expect(retry.status).toBe(204);
    expect(auth.deleteUser).toHaveBeenCalledTimes(2);
    expect(await owned(uid)).toEqual(nothing);
  });

  it("needs a signed-in user", async () => {
    expect((await request(app).delete("/api/profile")).status).toBe(401);
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });
});
