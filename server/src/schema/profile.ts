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
