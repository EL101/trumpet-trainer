import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { auth, firebaseError, googleClaims, guestClaims, tokenFor } from "./firebaseMock.js";
import { exerciseBody, newUid } from "./helpers.js";

const get = (token?: string) => {
  const req = request(app).get("/api/profile");
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("requireAuth", () => {
  it("rejects a request with no token", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or malformed token");
  });

  it("rejects a non-Bearer authorization header", async () => {
    const res = await request(app).get("/api/profile").set("Authorization", "Basic abc");
    expect(res.status).toBe(401);
  });

  it("rejects a token Firebase can't verify", async () => {
    const res = await get("forged");
    expect(res.status).toBe(401);
    expect(res.body.reauth).toBeUndefined();
  });

  it("checks for revocation when verifying", async () => {
    const token = tokenFor(googleClaims(newUid()));
    await get(token);
    expect(auth.verifyIdToken).toHaveBeenCalledWith(token, true);
  });

  it.each(["auth/id-token-revoked", "auth/user-not-found"])(
    "asks the client to sign in again on %s",
    async (code) => {
      auth.verifyIdToken.mockRejectedValueOnce(firebaseError(code));
      const res = await get("anything");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Session expired", reauth: true });
    },
  );

  it("returns 403 for a disabled account", async () => {
    auth.verifyIdToken.mockRejectedValueOnce(firebaseError("auth/user-disabled"));
    const res = await get("anything");
    expect(res.status).toBe(403);
  });

  it("creates the user row on first request, mirroring the token", async () => {
    const uid = newUid();
    const res = await get(tokenFor(googleClaims(uid, { email: "a@b.com", name: "Ann" })));

    expect(res.status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    expect(row).toMatchObject({ email: "a@b.com", displayName: "Ann", isAnonymous: false });
  });

  it("marks anonymous sign-ins as guests", async () => {
    const uid = newUid("guest");
    await get(tokenFor(guestClaims(uid)));
    const row = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    expect(row.isAnonymous).toBe(true);
  });

  it("lets a brand-new user save an exercise without a foreign key violation", async () => {
    const res = await request(app)
      .post("/api/history")
      .set("Authorization", `Bearer ${tokenFor(googleClaims(newUid()))}`)
      .send(exerciseBody());
    expect(res.status).toBe(201);
  });

  it("creates exactly one row when a user's first requests arrive together", async () => {
    const uid = newUid();
    const token = tokenFor(googleClaims(uid));
    const results = await Promise.all(Array.from({ length: 5 }, () => get(token)));

    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(await prisma.user.count({ where: { id: uid } })).toBe(1);
  });

  it("reports a database failure as a server error, not a bad token", async () => {
    const spy = vi.spyOn(prisma.user, "createMany").mockRejectedValueOnce(new Error("db down"));
    const res = await get(tokenFor(googleClaims(newUid())));
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to load user");
    spy.mockRestore();
  });
});
