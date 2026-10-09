import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { AVATAR_MAX_BYTES } from "../src/avatar.js";
import { setAvatar } from "../src/queries/avatars.js";
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
