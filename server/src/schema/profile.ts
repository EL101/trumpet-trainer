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
  /** When the account was made, as an ISO date-time. */
  createdAt: string;
};

/** Shape returned by GET /api/profile/stats. */
export type ProfileStats = {
  /** Exercises generated, ever: history is pruned, so this is counted as they're saved. */
  exercisesGenerated: number;
  /**
   * Different exercises with a scored run: replaying one doesn't count again. Counted
   * from the scores, so a reset of practice data takes it back to 0.
   */
  exercisesPlayed: number;
};

/**
 * The IANA time zone whose days practice is counted in (the browser's), UTC if none is
 * given. Only zone names: an offset such as "+05:00" means the opposite to Postgres
 * (POSIX signs), so it's turned down.
 */
const TimeZoneSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  })
  .default("UTC");

/**
 * Query of GET /api/profile/activity: the time zone, and the calendar year to show, or
 * none for the past year.
 */
export const ActivityQuerySchema = z.object({
  tz: TimeZoneSchema,
  year: z.coerce.number().int().min(2000).max(9999).optional(),
});

/** Query of GET /api/profile/streak: the time zone whose days make the streak. */
export const StreakQuerySchema = z.object({ tz: TimeZoneSchema });

/**
 * Shape returned by GET /api/profile/streak. A day counts if anything was played on
 * it, in the user's time zone.
 */
export type Streak = {
  /**
   * Days in a row played, up to today; or up to yesterday while today has nothing yet,
   * since the day isn't over. 0 once a whole day has gone by without play.
   */
  current: number;
  /** The most days in a row ever played. */
  longest: number;
  /** The days played this week, Monday first, as YYYY-MM-DD. */
  week: string[];
};

/** One day of GET /api/profile/activity: its date and how many exercises were played. */
export type ActivityDay = {
  /** The day in the user's time zone, as YYYY-MM-DD. */
  date: string;
  /** Different exercises with a scored run that day. */
  played: number;
};

/**
 * Shape returned by GET /api/profile/activity: the days with anything played, oldest
 * first, in the year asked for or else the last `ACTIVITY_DAYS`, and every year the
 * user has played in, newest first (for choosing one).
 */
export type Activity = { days: ActivityDay[]; years: number[] };
