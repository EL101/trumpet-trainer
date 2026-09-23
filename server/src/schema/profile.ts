import { z } from "zod";

/**
 * Body of POST /api/profile/merge-guest.
 *
 * The caller is authenticated as the account keeping the data; this token is
 * the guest account they are merging *from*. Holding both is the proof that the
 * same person controls both accounts.
 */
export const MergeGuestSchema = z.object({
  guestToken: z.string().min(1),
});

export type MergeGuestInput = z.infer<typeof MergeGuestSchema>;

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
