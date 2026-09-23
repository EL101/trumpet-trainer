import { prisma } from "../db.js";

/**
 * Node's Buffer is a Uint8Array<ArrayBufferLike>, but Prisma's Bytes field
 * wants a Uint8Array<ArrayBuffer>. Copying narrows it; an avatar is tens of KB.
 */
const toBytes = (data: Uint8Array) => Uint8Array.from(data);

export function setAvatar(userId: string, mimeType: string, data: Uint8Array) {
  const bytes = toBytes(data);
  return prisma.userAvatar.upsert({
    where: { userId },
    create: { userId, mimeType, data: bytes },
    update: { mimeType, data: bytes },
  });
}

/** Returns whether a row was actually removed, so the route can 404 honestly. */
export async function deleteAvatar(userId: string) {
  const { count } = await prisma.userAvatar.deleteMany({ where: { userId } });
  return count > 0;
}
