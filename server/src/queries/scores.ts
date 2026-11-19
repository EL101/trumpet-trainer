import { Prisma, type History, type PracticeScore } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import type { ScoreInput, Streak } from "../schema/index.js";
import { findExercise } from "./exercises.js";

/**
 * Scored runs that keep their feedback, per exercise. Older runs, and every run of an
 * exercise that's gone, keep their scores (the user's progress) but not their feedback.
 */
export const FEEDBACK_PER_EXERCISE = 20;

/**
 * How many scored runs a user can save: so many in any minute, and so many in any 24
 * hours (rolling, like the etude quota). The day comes first, so a user over both is
 * told about the one that lasts.
 */
export const SCORE_LIMITS = [
  { max: 300, per: "day", windowMs: 24 * 60 * 60 * 1000 },
  { max: 10, per: "minute", windowMs: 60 * 1000 },
] as const;

export type ScoreLimit = (typeof SCORE_LIMITS)[number];

/** What an exercise was, as a score keeps it. */
export type ExerciseInfo = Pick<
  History,
  "exerciseType" | "timeSig" | "musicKey" | "noteRange" | "difficulty"
>;

/**
 * The user's exercise, from their history or else their library, as a score keeps it:
 * null if it's in neither (not theirs, or gone).
 */
export async function findExerciseInfo(
  userId: string,
  exerciseId: string,
): Promise<ExerciseInfo | null> {
  const [history, library] = await Promise.all([
    findExercise("history", userId, exerciseId),
    findExercise("library", userId, exerciseId),
  ]);
  const row = history ?? library;
  if (!row) return null;
  const { exerciseType, timeSig, musicKey, noteRange, difficulty } = row;
  return { exerciseType, timeSig, musicKey, noteRange, difficulty };
}

/**
 * Saves a scored run, unless the user has saved as many as a limit allows in its window
 * (`SCORE_LIMITS`): then nothing is saved, and the limit is returned.
 *
 * The count and the insert run in one transaction holding a lock on the user's row, so
 * two saves at once are counted one after the other and can't both slip in under a
 * limit. Raw SQL for the lock, which Prisma can't take. NO KEY UPDATE, not UPDATE, so
 * it doesn't hold up the user's other writes that point at their row (history, the
 * library). Covered in test/scores.test.ts.
 */
export function insertScore(
  userId: string,
  exercise: ExerciseInfo,
  input: ScoreInput,
): Promise<{ saved: PracticeScore } | { limited: ScoreLimit }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
    for (const limit of SCORE_LIMITS) {
      const used = await tx.practiceScore.count({
        where: { userId, createdAt: { gt: new Date(Date.now() - limit.windowMs) } },
      });
      if (used >= limit.max) return { limited: limit };
    }
    return {
      saved: await tx.practiceScore.create({ data: { userId, ...exercise, ...input } }),
    };
  });
}

/**
 * The user's newest scored run of an exercise that still has its feedback, or null if
 * there's none.
 */
export function latestScore(userId: string, exerciseId: string) {
  return prisma.practiceScore.findFirst({
    where: { userId, exerciseId, rightNotesFeedback: { not: Prisma.DbNull } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/**
 * How many different exercises the user has a scored run of: their "exercises played".
 * Playing one again doesn't add to it.
 */
export async function countPlayedExercises(userId: string) {
  const played = await prisma.practiceScore.groupBy({ by: ["exerciseId"], where: { userId } });
  return played.length;
}

/** How far back the activity grid goes: 53 weeks, a year with the week it ends in. */
export const ACTIVITY_DAYS = 53 * 7;

/**
 * How many different exercises the user played each day, counted in `timeZone` (an
 * IANA name, checked by ActivityQuerySchema): only days with any, oldest first. The
 * days are those of `year` there, or with no year the last `ACTIVITY_DAYS`.
 *
 * Raw SQL: Prisma can't group by the day a timestamp falls on in a time zone. The
 * year's bounds are turned into instants, so the (user, created) index finds the
 * runs. Covered in test/activity.test.ts.
 */
export function playedPerDay(userId: string, timeZone: string, year?: number) {
  const since =
    year === undefined
      ? Prisma.sql`now() - ${ACTIVITY_DAYS} * interval '1 day'`
      : Prisma.sql`make_date(${year}::int, 1, 1)::timestamp AT TIME ZONE ${timeZone}`;
  const until =
    year === undefined
      ? Prisma.sql`'infinity'::timestamptz`
      : Prisma.sql`make_date(${year}::int + 1, 1, 1)::timestamp AT TIME ZONE ${timeZone}`;
  return prisma.$queryRaw<{ date: string; played: number }[]>`
    SELECT to_char(created_at AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS date,
           count(DISTINCT exercise_id)::int AS played
    FROM practice_scores
    WHERE user_id = ${userId} AND created_at >= ${since} AND created_at < ${until}
    GROUP BY 1
    ORDER BY 1`;
}

/**
 * The years, in `timeZone`, the user played anything in: newest first. Raw SQL for
 * the time zone, as above; covered in test/activity.test.ts.
 */
export async function playedYears(userId: string, timeZone: string) {
  const rows = await prisma.$queryRaw<{ year: number }[]>`
    SELECT DISTINCT extract(year FROM created_at AT TIME ZONE ${timeZone})::int AS year
    FROM practice_scores
    WHERE user_id = ${userId}
    ORDER BY 1 DESC`;
  return rows.map((row) => row.year);
}

/**
 * The user's streaks and the days they played this week, counted in `timeZone` (an
 * IANA name, checked by StreakQuerySchema). See `Streak` for what each means.
 *
 * Raw SQL: the runs of days in a row are found with a window function (each day less
 * its row number is the same all through a run), which Prisma can't express, over the
 * days in the time zone, which it can't group by either. Covered in test/streak.test.ts.
 */
export async function streaks(userId: string, timeZone: string): Promise<Streak> {
  const [row] = await prisma.$queryRaw<Streak[]>`
    WITH days AS (
      SELECT DISTINCT (created_at AT TIME ZONE ${timeZone})::date AS day
      FROM practice_scores
      WHERE user_id = ${userId}
    ),
    today AS (SELECT (now() AT TIME ZONE ${timeZone})::date AS day),
    runs AS (
      SELECT count(*)::int AS length, max(day) AS last
      FROM (SELECT day, day - (row_number() OVER (ORDER BY day))::int AS run FROM days) d
      GROUP BY run
    )
    SELECT
      coalesce((SELECT max(length) FROM runs), 0) AS longest,
      coalesce((SELECT max(length) FROM runs, today WHERE runs.last >= today.day - 1), 0)
        AS current,
      coalesce(
        (SELECT array_agg(to_char(days.day, 'YYYY-MM-DD') ORDER BY days.day)
         FROM days, today
         WHERE days.day >= date_trunc('week', today.day)::date),
        '{}'
      ) AS week`;
  return row;
}

/**
 * Delete every scored run the user has, feedback and all: their practice data. Their
 * exercises, history and settings stay. Returns how many runs went.
 */
export async function deleteScores(userId: string) {
  const { count } = await prisma.practiceScore.deleteMany({ where: { userId } });
  return count;
}

/**
 * How long a run stays marked as orphaned before its feedback can be cleared: past the
 * next hourly prune, so its exercise has a whole run's time to come back (history
 * cleared, the exercise saved again). Also keeps two server instances' prunes, run close
 * together, from marking and clearing in one go.
 */
export const ORPHAN_GRACE_MS = 30 * 60 * 1000;

/**
 * Lets go of the feedback no one will be shown: that of exercises in neither the
 * user's history nor their library (pruned, cleared or removed), and that of runs past
 * each exercise's newest `limit`. The four feedback columns are cleared; the row, its
 * scores and what the exercise was stay, for the user's progress.
 *
 * An exercise can be out of both tables for a moment (history cleared, and the
 * exercise on the plate saved again), so its runs aren't cleared straight away: a prune
 * marks them (feedback_orphaned_at), and a later one, at least `graceMs` after, clears
 * them if the exercise is still gone. One that's come back is unmarked. Returns how many
 * runs' feedback was cleared, and how many were newly marked.
 *
 * Raw SQL: the scores aren't related to history or library rows in the schema (an
 * exercise can be in either), so Prisma can't write the NOT EXISTS. A run is past the
 * limit when `limit` newer runs of its exercise exist; that's counted per run that still
 * has feedback, stopping at the limit. The runs with feedback come from their own partial
 * index (idx_practice_scores_with_feedback), the marked ones from theirs
 * (idx_practice_scores_orphaned), and the count from the (user, exercise, created) one,
 * so the work follows the feedback kept, not the size of the table, which keeps every
 * run. Covered in test/scores.test.ts.
 */
export async function pruneFeedback(limit = FEEDBACK_PER_EXERCISE, graceMs = ORPHAN_GRACE_MS) {
  // The exercise is back: unmark.
  await prisma.$executeRaw`
    UPDATE practice_scores s
    SET feedback_orphaned_at = NULL
    WHERE s.feedback_orphaned_at IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM history h WHERE h.user_id = s.user_id AND h.exercise_id = s.exercise_id
        )
        OR EXISTS (
          SELECT 1 FROM library l WHERE l.user_id = s.user_id AND l.exercise_id = s.exercise_id
        )
      )`;
  // Marked by an earlier prune, and still gone: clear.
  const orphans = await prisma.$executeRaw`
    UPDATE practice_scores s
    SET right_notes_feedback = NULL, rhythm_feedback = NULL,
        intonation_feedback = NULL, tone_feedback = NULL, feedback_orphaned_at = NULL
    WHERE s.feedback_orphaned_at IS NOT NULL
      AND s.feedback_orphaned_at <= now() - ${graceMs} * interval '1 millisecond'
      AND NOT EXISTS (
        SELECT 1 FROM history h WHERE h.user_id = s.user_id AND h.exercise_id = s.exercise_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM library l WHERE l.user_id = s.user_id AND l.exercise_id = s.exercise_id
      )`;
  // Newly gone: mark, for a later prune.
  const marked = await prisma.$executeRaw`
    UPDATE practice_scores s
    SET feedback_orphaned_at = now()
    WHERE s.right_notes_feedback IS NOT NULL
      AND s.feedback_orphaned_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM history h WHERE h.user_id = s.user_id AND h.exercise_id = s.exercise_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM library l WHERE l.user_id = s.user_id AND l.exercise_id = s.exercise_id
      )`;
  const excess = await prisma.$executeRaw`
    UPDATE practice_scores s
    SET right_notes_feedback = NULL, rhythm_feedback = NULL,
        intonation_feedback = NULL, tone_feedback = NULL, feedback_orphaned_at = NULL
    WHERE s.right_notes_feedback IS NOT NULL
      AND (
        SELECT count(*) FROM (
          SELECT 1 FROM practice_scores n
          WHERE n.user_id = s.user_id AND n.exercise_id = s.exercise_id
            AND (n.created_at, n.id) > (s.created_at, s.id)
          LIMIT ${limit}
        ) newer
      ) >= ${limit}`;
  return { cleared: orphans + excess, marked };
}
