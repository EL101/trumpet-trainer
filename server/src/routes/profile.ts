import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { requireAuth } from "../middleware/requireAuth.js";
import { AvatarUploadSchema, GuestTokenSchema, type Profile } from "../schema/index.js";
import {
  discardGuest,
  getUserWithAvatar,
  mergeGuestData,
  syncUserFromClaims,
} from "../queries/users.js";
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
  if (req.user!.firebase?.sign_in_provider === "anonymous") {
    return res.status(403).json({ error: "Sign in to upload a profile picture" });
  }

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
 * Verify the guest token in the body against the caller, or send the error.
 * Shared by merge-guest and discard-guest: both act on an account other than
 * the caller's, so both need the same proof that the caller controls it.
 */
async function verifyGuest(req: Request, res: Response) {
  const parsed = GuestTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return null;
  }

  let guest: admin.auth.DecodedIdToken;
  try {
    // checkRevoked, matching requireAuth: a swept guest's token must not work.
    guest = await admin.auth().verifyIdToken(parsed.data.guestToken, true);
  } catch {
    res.status(401).json({ error: "Invalid guest token" });
    return null;
  }

  // Without this, any token would let its holder vacuum up -- or wipe out --
  // another account's exercises. Only a genuine anonymous account qualifies.
  if (guest.firebase?.sign_in_provider !== "anonymous") {
    res.status(400).json({ error: "Not a guest account" });
    return null;
  }
  if (guest.uid === req.user!.uid) {
    res.status(400).json({ error: "Cannot act on your own account" });
    return null;
  }
  return guest;
}

/** Retire the emptied guest. Not fatal on failure -- the sweep collects it later. */
async function deleteFirebaseGuest(uid: string) {
  try {
    await admin.auth().deleteUser(uid);
  } catch (err) {
    console.error(`Could not delete guest ${uid} from Firebase:`, err);
  }
}

/**
 * Move a guest account's exercises onto the caller's account.
 *
 * Used when linkWithPopup reports auth/credential-already-in-use and the user
 * chooses to bring their guest exercises with them: the Google account already
 * exists, so the guest uid can't be upgraded in place and the rows have to be
 * carried across by hand.
 */
router.post("/merge-guest", requireAuth, async (req: Request, res: Response) => {
  const guest = await verifyGuest(req, res);
  if (!guest) return;

  try {
    const moved = await mergeGuestData(guest.uid, req.user!.uid);
    await deleteFirebaseGuest(guest.uid);
    res.json(moved);
  } catch (err) {
    console.error("Failed to merge guest data:", err);
    res.status(500).json({ error: "Failed to merge guest data" });
  }
});

/**
 * Delete a guest account and everything it owns. The other half of the choice
 * offered when linking lands on an existing Google account.
 */
router.post("/discard-guest", requireAuth, async (req: Request, res: Response) => {
  const guest = await verifyGuest(req, res);
  if (!guest) return;

  try {
    await discardGuest(guest.uid);
    await deleteFirebaseGuest(guest.uid);
    res.status(204).end();
  } catch (err) {
    console.error("Failed to discard guest data:", err);
    res.status(500).json({ error: "Failed to discard guest data" });
  }
});

export default router;
