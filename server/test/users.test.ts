import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/db.js";
import { setAvatar } from "../src/queries/avatars.js";
import {
  GUEST_TTL_MS,
  ensureUserExists,
  mergeGuestData,
  sweepAbandonedGuests,
} from "../src/queries/users.js";
import { auth, googleClaims } from "./firebaseMock.js";
import { JPEG, PNG, addHistory, addLibrary, createUser, newUid } from "./helpers.js";

const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.restoreAllMocks();
});

const generations = async (table: "history" | "library", userId: string) =>
  (
    await (prisma[table] as typeof prisma.history).findMany({
      where: { userId },
      orderBy: { generationNum: "asc" },
    })
  ).map((row) => row.generationNum);

describe("ensureUserExists", () => {
  it("refreshes lastSeenAt at most once an hour", async () => {
    const uid = newUid();
    const start = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(start);
    await ensureUserExists(googleClaims(uid) as never);

    const stale = new Date(start - 5 * HOUR);
    await prisma.user.update({ where: { id: uid }, data: { lastSeenAt: stale } });

    vi.spyOn(Date, "now").mockReturnValue(start + 30 * 60 * 1000);
    await ensureUserExists(googleClaims(uid) as never);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: uid } })).lastSeenAt).toEqual(stale);

    vi.spyOn(Date, "now").mockReturnValue(start + HOUR + 1);
    await ensureUserExists(googleClaims(uid) as never);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: uid } })).lastSeenAt).toEqual(
      new Date(start + HOUR + 1),
    );
  });
});

describe("mergeGuestData", () => {
  it("renumbers the guest's exercises after the target's, per table", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await addHistory(target, 1, 2, 3);
    await addLibrary(target, 1);
    await addHistory(guest, 1, 2);
    await addLibrary(guest, 1, 2);

    expect(await mergeGuestData(guest, target)).toEqual({ history: 2, library: 2 });
    expect(await generations("history", target)).toEqual([1, 2, 3, 4, 5]);
    expect(await generations("library", target)).toEqual([1, 2, 3]);
  });

  it("keeps the guest's numbers when the target has no exercises", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await addHistory(guest, 1, 2);

    await mergeGuestData(guest, target);
    expect(await generations("history", target)).toEqual([1, 2]);
  });

  it("deletes the guest row without cascading away the moved rows", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await addHistory(guest, 1);

    await mergeGuestData(guest, target);
    expect(await prisma.user.findUnique({ where: { id: guest } })).toBeNull();
    expect(await prisma.history.count({ where: { userId: target } })).toBe(1);
  });

  it("adopts the guest's avatar when the target has none", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await setAvatar(guest, "image/png", PNG);

    await mergeGuestData(guest, target);
    const avatar = await prisma.userAvatar.findUniqueOrThrow({ where: { userId: target } });
    expect(avatar.mimeType).toBe("image/png");
  });

  it("keeps the target's own avatar and discards the guest's", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await createUser(target);
    await setAvatar(guest, "image/png", PNG);
    await setAvatar(target, "image/jpeg", JPEG);

    await mergeGuestData(guest, target);
    const avatars = await prisma.userAvatar.findMany();
    expect(avatars).toHaveLength(1);
    expect(avatars[0]).toMatchObject({ userId: target, mimeType: "image/jpeg" });
  });

  it("works when the guest never reached the API and has no row", async () => {
    const target = newUid();
    await createUser(target);
    expect(await mergeGuestData(newUid("guest"), target)).toEqual({ history: 0, library: 0 });
  });

  it("rolls back everything if any step fails", async () => {
    const guest = newUid("guest");
    const target = newUid();
    await createUser(guest, { isAnonymous: true });
    await addHistory(guest, 1);
    // No target row: moving history onto it violates the foreign key.

    await expect(mergeGuestData(guest, target)).rejects.toThrow();
    expect(await prisma.history.count({ where: { userId: guest } })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: guest } })).not.toBeNull();
  });
});

describe("sweepAbandonedGuests", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  const old = new Date(now - GUEST_TTL_MS - HOUR);
  const recent = new Date(now - HOUR);

  const firebaseUser = (uid: string, created: Date, providers: string[] = []) => ({
    uid,
    providerData: providers.map((providerId) => ({ providerId })),
    metadata: { creationTime: created.toUTCString() },
  });

  it("deletes old, idle guests from Postgres and Firebase", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: old });
    await addHistory(uid, 1);
    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(uid, old)] });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1, scanned: 1 });
    expect(await prisma.user.findUnique({ where: { id: uid } })).toBeNull();
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(0);
    expect(auth.deleteUsers).toHaveBeenCalledWith([uid]);
  });

  it("keeps guests created within the TTL", async () => {
    const uid = newUid("guest");
    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(uid, recent)] });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 0, scanned: 1 });
    expect(auth.deleteUsers).not.toHaveBeenCalled();
  });

  it("keeps old guests who are still active", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: recent });
    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(uid, old)] });

    await sweepAbandonedGuests(now);
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
    expect(auth.deleteUsers).not.toHaveBeenCalled();
  });

  it("never touches accounts with a linked provider", async () => {
    const uid = newUid();
    await createUser(uid, { lastSeenAt: old });
    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(uid, old, ["google.com"])] });

    await sweepAbandonedGuests(now);
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
    expect(auth.deleteUsers).not.toHaveBeenCalled();
  });

  it("deletes guests who never reached the API and have no row", async () => {
    const uid = newUid("guest");
    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(uid, old)] });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1, scanned: 1 });
    expect(auth.deleteUsers).toHaveBeenCalledWith([uid]);
  });

  it("reads every page of Firebase users", async () => {
    const [a, b] = [newUid("guest"), newUid("guest")];
    auth.listUsers
      .mockResolvedValueOnce({ users: [firebaseUser(a, old)], pageToken: "next" })
      .mockResolvedValueOnce({ users: [firebaseUser(b, old)] });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 2, scanned: 2 });
    expect(auth.listUsers).toHaveBeenLastCalledWith(1000, "next");
  });

  it("deletes in batches of 1000", async () => {
    const users = Array.from({ length: 1500 }, () => firebaseUser(newUid("guest"), old));
    auth.listUsers.mockResolvedValueOnce({ users });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1500, scanned: 1500 });
    expect(auth.deleteUsers.mock.calls.map(([uids]) => uids.length)).toEqual([1000, 500]);
  });

  it("counts only the Firebase deletes that succeeded", async () => {
    const [a, b] = [newUid("guest"), newUid("guest")];
    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(a, old), firebaseUser(b, old)] });
    auth.deleteUsers.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 1,
      errors: [{ index: 1, error: { message: "boom" } }],
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1, scanned: 2 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining(b), "boom");
  });

  it("recreates a swept guest's row if they come back", async () => {
    const uid = newUid("guest");
    vi.spyOn(Date, "now").mockReturnValue(now - GUEST_TTL_MS - HOUR);
    await ensureUserExists({ uid, firebase: { sign_in_provider: "anonymous" } } as never);
    vi.restoreAllMocks();

    auth.listUsers.mockResolvedValueOnce({ users: [firebaseUser(uid, old)] });
    await sweepAbandonedGuests(now);

    await ensureUserExists({ uid, firebase: { sign_in_provider: "anonymous" } } as never);
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });
});
