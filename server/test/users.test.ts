import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/db.js";
import { setAvatar } from "../src/queries/avatars.js";
import {
  GUEST_TTL_MS,
  discardGuest,
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

  it("treats 48 hours of inactivity as abandoned", () => {
    expect(GUEST_TTL_MS).toBe(48 * HOUR);
  });

  it("deletes idle guests from Postgres and Firebase", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: old });
    await addHistory(uid, 1);
    await addLibrary(uid, 1);

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1, scanned: 1 });
    expect(await prisma.user.findUnique({ where: { id: uid } })).toBeNull();
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(0);
    expect(await prisma.library.count({ where: { userId: uid } })).toBe(0);
    expect(auth.deleteUsers).toHaveBeenCalledWith([uid]);
  });

  it("keeps guests seen within the TTL", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: recent });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 0, scanned: 0 });
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
    expect(auth.deleteUsers).not.toHaveBeenCalled();
  });

  it("keeps a guest seen 47 hours ago", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: new Date(now - 47 * HOUR) });

    await sweepAbandonedGuests(now);
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });

  it("never touches idle non-guest rows", async () => {
    const uid = newUid();
    await createUser(uid, { lastSeenAt: old });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 0, scanned: 0 });
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });

  it("repairs, rather than deletes, a row whose guest has since linked Google", async () => {
    const uid = newUid("linked");
    await createUser(uid, { isAnonymous: true, lastSeenAt: old });
    await addHistory(uid, 1);
    auth.getUsers.mockResolvedValueOnce({
      users: [{ uid, providerData: [{ providerId: "google.com" }] }],
      notFound: [],
    });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 0, scanned: 1 });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    expect(row.isAnonymous).toBe(false);
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(1);
    expect(auth.deleteUsers).not.toHaveBeenCalled();
  });

  it("deletes a row whose Firebase account is already gone", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: old });
    auth.getUsers.mockResolvedValueOnce({ users: [], notFound: [{ uid }] });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1, scanned: 1 });
    expect(await prisma.user.findUnique({ where: { id: uid } })).toBeNull();
  });

  it("works through more guests than one batch holds", async () => {
    const uids = Array.from({ length: 250 }, () => newUid("guest"));
    for (const uid of uids) await createUser(uid, { isAnonymous: true, lastSeenAt: old });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 250, scanned: 250 });
    expect(auth.getUsers.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 50]);
    expect(await prisma.user.count({ where: { id: { in: uids } } })).toBe(0);
  });

  it("keeps the row when its Firebase delete fails, and moves on", async () => {
    const [a, b] = [newUid("guest-a"), newUid("guest-b")];
    await createUser(a, { isAnonymous: true, lastSeenAt: old });
    await createUser(b, { isAnonymous: true, lastSeenAt: old });
    auth.deleteUsers.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 1,
      errors: [{ index: 1, error: { message: "boom" } }],
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 1, scanned: 2 });
    expect(await prisma.user.findUnique({ where: { id: a } })).toBeNull();
    // Still there, so the next sweep retries it.
    expect(await prisma.user.findUnique({ where: { id: b } })).not.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(b), "boom");
  });

  it("spares a guest who comes back between the scan and the delete", async () => {
    const uid = newUid("guest");
    await createUser(uid, { isAnonymous: true, lastSeenAt: old });
    auth.deleteUsers.mockImplementationOnce(async (uids: string[]) => {
      await prisma.user.update({ where: { id: uid }, data: { lastSeenAt: new Date(now) } });
      return { successCount: uids.length, failureCount: 0, errors: [] };
    });

    expect(await sweepAbandonedGuests(now)).toEqual({ deleted: 0, scanned: 1 });
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });

  it("recreates a swept guest's row if they come back", async () => {
    const uid = newUid("guest");
    vi.spyOn(Date, "now").mockReturnValue(now - GUEST_TTL_MS - HOUR);
    await ensureUserExists({ uid, firebase: { sign_in_provider: "anonymous" } } as never);
    vi.restoreAllMocks();

    await sweepAbandonedGuests(now);
    expect(await prisma.user.findUnique({ where: { id: uid } })).toBeNull();

    await ensureUserExists({ uid, firebase: { sign_in_provider: "anonymous" } } as never);
    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
  });
});

describe("discardGuest", () => {
  it("deletes a guest row and everything it owns", async () => {
    const guest = newUid("guest");
    await createUser(guest, { isAnonymous: true });
    await addHistory(guest, 1);
    await addLibrary(guest, 1);

    await discardGuest(guest);

    expect(await prisma.user.findUnique({ where: { id: guest } })).toBeNull();
    expect(await prisma.history.count({ where: { userId: guest } })).toBe(0);
    expect(await prisma.library.count({ where: { userId: guest } })).toBe(0);
  });

  it("never deletes a non-anonymous user", async () => {
    const uid = newUid();
    await createUser(uid);
    await addHistory(uid, 1);

    await discardGuest(uid);

    expect(await prisma.user.findUnique({ where: { id: uid } })).not.toBeNull();
    expect(await prisma.history.count({ where: { userId: uid } })).toBe(1);
  });
});
