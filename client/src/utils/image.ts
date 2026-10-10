/** Avatars are normalised to this many pixels square before upload. */
export const AVATAR_SIZE = 256;

/** Refuse to decode anything larger than this; a phone photo is ~5MB. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** Carries a message that is safe to show the user. */
export class AvatarImageError extends Error {}

/**
 * The largest centred square that fits inside a width x height image.
 * Extracted from the canvas work so the arithmetic can be tested directly.
 */
export function squareCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    side,
  };
}

/**
 * Turn a user-picked file into a small square WebP data URL.
 *
 * Doing this client-side is what keeps uploads at tens of KB instead of
 * megabytes; the server re-validates regardless.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarImageError("That image is too large. Please pick one under 10MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC from an iPhone lands here on every browser but Safari.
    throw new AvatarImageError("Couldn't read that image. Try a PNG, JPEG or WebP.");
  }

  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AvatarImageError("Couldn't process that image.");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    // A browser without WebP encoding silently falls back to PNG, which the
    // server also accepts -- only the upload is a little larger.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob) throw new AvatarImageError("Couldn't process that image.");

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new AvatarImageError("Couldn't read that image."));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
  }
}
