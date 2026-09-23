/** Decoded avatars larger than this are rejected. */
export const AVATAR_MAX_BYTES = 512 * 1024;

/** Request body limit for the upload route; base64 inflates bytes by ~33%. */
export const AVATAR_BODY_LIMIT = "1mb";

const SIGNATURES: ReadonlyArray<{ mime: string; matches: (b: Buffer) => boolean }> = [
  {
    mime: "image/png",
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/webp",
    matches: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
];

/**
 * Identify an image by its leading bytes.
 *
 * The media type in the data URL is attacker-controlled, so it is only used to
 * reject obvious junk early -- what actually gets stored is decided here.
 */
export function sniffImageMime(bytes: Buffer): string | null {
  return SIGNATURES.find((sig) => sig.matches(bytes))?.mime ?? null;
}

export class AvatarError extends Error {}

/** Decode a base64 image data URL, or throw AvatarError explaining why not. */
export function decodeAvatarDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = /^data:image\/[a-z+]+;base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new AvatarError("Expected a base64 image data URL");

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0) throw new AvatarError("Image is empty");
  if (bytes.length > AVATAR_MAX_BYTES) {
    throw new AvatarError(`Image is larger than ${Math.round(AVATAR_MAX_BYTES / 1024)}KB`);
  }

  const mime = sniffImageMime(bytes);
  if (!mime) throw new AvatarError("Only PNG, JPEG and WebP images are supported");

  return { mime, bytes };
}

/** Inline an avatar for the client. Prisma returns Bytes as Uint8Array. */
export function toDataUrl(mimeType: string, data: Uint8Array): string {
  return `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`;
}
