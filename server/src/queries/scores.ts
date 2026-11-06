import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import type { ScoreInput } from "../schema/index.js";

/**
 * Scored runs that keep their feedback, per exercise. Older runs, and every run of an
 * exercise that's gone, keep their scores (the user's progress) but not their feedback.
 */
export const FEEDBACK_PER_EXERCISE = 20;

/** What an exercise was, as a score keeps it. */
const EXERCISE_INFO = {
  exerciseType: true,
  timeSig: true,
  musicKey: true,
  noteRange: true,
  difficulty: true,
} as const;

export type ExerciseInfo = Prisma.HistoryGetPayload<{ select: typeof EXERCISE_INFO }>;

/**
 * The user's exercise, from their history or else their library, as a score keeps it:
 * null if it's in neither (not theirs, or gone).
 */
export async function findExercise(
  userId: string,
  exerciseId: string,
): Promise<ExerciseInfo | null> {
  const where = { userId, exerciseId };
  const [history, library] = await Promise.all([
    prisma.history.findFirst({ where, select: EXERCISE_INFO }),
    prisma.library.findFirst({ where, select: EXERCISE_INFO }),
  ]);
  return history ?? library;
}

export function insertScore(userId: string, exercise: ExerciseInfo, input: ScoreInput) {
  return prisma.practiceScore.create({ data: { userId, ...exercise, ...input } });
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
 * Lets go of the feedback no one will be shown: that of exercises in neither the
 * user's history nor their library (pruned, cleared or removed), and that of runs past
 * each exercise's newest `limit`. The four feedback columns are cleared; the row, its
 * scores and what the exercise was stay, for the user's progress. Returns how many
 * rows were cleared.
 *
 * Raw SQL: the scores aren't related to history or library rows in the schema (an
 * exercise can be in either), so Prisma can't write the NOT EXISTS, and keeping the
 * newest per exercise needs a window function. Covered in test/scores.test.ts.
 */
export async function pruneFeedback(limit = FEEDBACK_PER_EXERCISE) {
  const orphans = await prisma.$executeRaw`
    UPDATE practice_scores s
    SET right_notes_feedback = NULL, rhythm_feedback = NULL,
        intonation_feedback = NULL, tone_feedback = NULL
    WHERE s.right_notes_feedback IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM history h WHERE h.user_id = s.user_id AND h.exercise_id = s.exercise_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM library l WHERE l.user_id = s.user_id AND l.exercise_id = s.exercise_id
      )`;
  const excess = await prisma.$executeRaw`
    UPDATE practice_scores
    SET right_notes_feedback = NULL, rhythm_feedback = NULL,
        intonation_feedback = NULL, tone_feedback = NULL
    WHERE right_notes_feedback IS NOT NULL
      AND id IN (
        SELECT id FROM (
          SELECT id, row_number() OVER (
            PARTITION BY user_id, exercise_id ORDER BY created_at DESC, id DESC
          ) AS place
          FROM practice_scores
        ) ranked
        WHERE place > ${limit}
      )`;
  return orphans + excess;
}
