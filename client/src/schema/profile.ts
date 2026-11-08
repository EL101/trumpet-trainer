import type { NoteRanges } from "@/lib/noteRanges";

/** Shape returned by GET /api/profile. Mirrors server/src/schema/profile.ts. */
export type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  /** Uploaded avatar as a data URL, else the provider photo, else null. */
  avatarUrl: string | null;
  /** True when avatarUrl is the user's own upload rather than a provider photo. */
  hasUpload: boolean;
  /** When the account was made, as an ISO date-time. */
  createdAt: string;
};

/** Shape returned by GET /api/profile/stats. Mirrors server/src/schema/profile.ts. */
export type ProfileStats = {
  /** Exercises generated, ever (history is pruned, so the server counts them). */
  exercisesGenerated: number;
  /** Different exercises with a scored run (replays don't count again); a reset takes it to 0. */
  exercisesPlayed: number;
};

/** The user's settings, as GET and PUT /api/settings send them. */
export type Settings = {
  /** What Low, Medium and High cover, as MIDI numbers (see `lib/noteRanges`). */
  noteRanges: NoteRanges;
};
