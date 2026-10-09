import { randomUUID } from "node:crypto";
import { prisma } from "../src/db.js";

/**
 * A uid no other test has used. ensureUserExists caches uids per process, so
 * reusing one after the tables are truncated would skip recreating its row.
 */
export const newUid = (label = "user") => `${label}-${randomUUID()}`;

export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
export const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP"),
]);

export const dataUrl = (bytes: Buffer, mime = "image/png") =>
  `data:${mime};base64,${bytes.toString("base64")}`;

export function createUser(id: string, data: { isAnonymous?: boolean; lastSeenAt?: Date } = {}) {
  return prisma.user.create({ data: { id, ...data } });
}

const exercise = (userId: string, generationNum: number) => ({
  userId,
  generationNum,
  notes: `notes-${generationNum}`,
  timeSig: "4/4",
  musicKey: "C",
  noteRange: "C4-C5",
  difficulty: "easy",
});

export function addHistory(userId: string, ...generationNums: number[]) {
  return prisma.history.createMany({ data: generationNums.map((n) => exercise(userId, n)) });
}

export function addLibrary(userId: string, ...generationNums: number[]) {
  return prisma.library.createMany({ data: generationNums.map((n) => exercise(userId, n)) });
}

export const exerciseBody = (generationNum = 1) => {
  const { userId: _, ...body } = exercise("", generationNum);
  return body;
};
