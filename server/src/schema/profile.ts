import { z } from "zod";

/**
 * Body of POST /api/profile/merge-guest and /api/profile/discard-guest.
 *
 * The caller is authenticated as the account they are keeping; this token is
 * the guest account being merged or discarded. Holding both is the proof that
 * the same person controls both accounts.
 */
export const GuestTokenSchema = z.object({
  guestToken: z.string().min(1),
});

export type GuestTokenInput = z.infer<typeof GuestTokenSchema>;

/** Body of PUT /api/profile/avatar. The data URL is validated in avatar.ts. */
export const AvatarUploadSchema = z.object({
  dataUrl: z.string().min(1),
});

export type AvatarUpload = z.infer<typeof AvatarUploadSchema>;

/** Shape returned by GET /api/profile. */
export type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  /** Uploaded avatar as a data URL, else the provider photo, else null. */
  avatarUrl: string | null;
  /** True when avatarUrl is the user's own upload rather than a provider photo. */
  hasUpload: boolean;
};
