import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { requireAuth } from "../middleware/requireAuth.js";
import { AvatarUploadSchema, MergeGuestSchema, type Profile } from "../schema/index.js";
import { getUserWithAvatar, mergeGuestData, syncUserFromClaims } from "../queries/users.js";
import { deleteAvatar, setAvatar } from "../queries/avatars.js";
import { AvatarError, decodeAvatarDataUrl, toDataUrl } from "../avatar.js";

const router = Router();

/**
 * The caller's profile. requireAuth has already created the row if it was
 * missing, so this only reads.
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await getUserWithAvatar(req.user!.uid);
    if (!user) return res.status(404).json({ error: "Profile not found" });

    const profile: Profile = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isAnonymous: user.isAnonymous,
      // An upload wins; otherwise fall back to the provider photo on the token,
      // so a Google user has a picture before ever uploading one.
      avatarUrl: user.avatar
        ? toDataUrl(user.avatar.mimeType, user.avatar.data)
        : ((req.user!.picture as string | undefined) ?? null),
      hasUpload: user.avatar !== null,
    };
    res.json(profile);
  } catch (err) {
    console.error("Failed to load profile:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

/** Replace the caller's avatar. Body is a base64 image data URL. */
router.put("/avatar", requireAuth, async (req: Request, res: Response) => {
  const parsed = AvatarUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  let image: { mime: string; bytes: Buffer };
  try {
    image = decodeAvatarDataUrl(parsed.data.dataUrl);
  } catch (err) {
    // Client-side resizing should make these unreachable; it is not trusted.
    if (err instanceof AvatarError) return res.status(400).json({ error: err.message });
    throw err;
  }

  try {
    await setAvatar(req.user!.uid, image.mime, image.bytes);
    res.json({ avatarUrl: toDataUrl(image.mime, image.bytes), hasUpload: true });
  } catch (err) {
    console.error("Failed to save avatar:", err);
    res.status(500).json({ error: "Failed to save avatar" });
  }
});

/** Drop the uploaded avatar, reverting to the provider photo or initials. */
router.delete("/avatar", requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteAvatar(req.user!.uid);
    res.status(204).end();
  } catch (err) {
    console.error("Failed to delete avatar:", err);
    res.status(500).json({ error: "Failed to delete avatar" });
  }
});

/**
 * Re-mirror the caller's profile fields from their current token claims.
 * The client calls this after linking a Google account, which leaves the uid
 * alone but turns a nameless guest row into a real profile.
 */
router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await syncUserFromClaims(req.user!));
  } catch (err) {
    console.error("Failed to sync profile:", err);
    res.status(500).json({ error: "Failed to sync profile" });
  }
});

/**
 * Move a guest account's exercises onto the caller's account.
 *
 * Used when linkWithPopup reports auth/credential-already-in-use: the Google
 * account already exists, so the guest uid can't be upgraded in place and the
 * rows have to be carried across by hand.
 */
router.post("/merge-guest", requireAuth, async (req: Request, res: Response) => {
  const parsed = MergeGuestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  let guest: admin.auth.DecodedIdToken;
  try {
    guest = await admin.auth().verifyIdToken(parsed.data.guestToken);
  } catch {
    return res.status(401).json({ error: "Invalid guest token" });
  }

  // Without this, any token would let its holder vacuum up another account's
  // exercises. Only a genuine anonymous account can be merged away.
  if (guest.firebase?.sign_in_provider !== "anonymous") {
    return res.status(400).json({ error: "Not a guest account" });
  }
  if (guest.uid === req.user!.uid) {
    return res.status(400).json({ error: "Cannot merge an account into itself" });
  }

  try {
    const moved = await mergeGuestData(guest.uid, req.user!.uid);
    // The guest account is empty now, so retire it instead of leaving it for
    // the sweep. Failure here is not fatal -- the sweep collects it later.
    try {
      await admin.auth().deleteUser(guest.uid);
    } catch (err) {
      console.error(`Merged guest ${guest.uid} but could not delete it:`, err);
    }
    res.json(moved);
  } catch (err) {
    console.error("Failed to merge guest data:", err);
    res.status(500).json({ error: "Failed to merge guest data" });
  }
});

export default router;
