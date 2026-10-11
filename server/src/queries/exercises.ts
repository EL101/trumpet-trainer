import { prisma } from "../db.js";
import type { ExerciseInput, ExerciseTable } from "../schema/index.js";

/** History rows kept per user. The library has no limit. */
export const HISTORY_LIMIT = 100;

// `history` is browsed newest-generation-first, and only its newest
// HISTORY_LIMIT rows are listed; `library` is browsed newest-saved-first.
export function listExercises(table: ExerciseTable, userId: string) {
  return table === "history"
    ? prisma.history.findMany({
        where: { userId },
        // createdAt and id settle ties (a re-saved generation), in the same
        // order pruneHistory ranks rows, so the rows listed are the rows kept.
        orderBy: [{ generationNum: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: HISTORY_LIMIT,
      })
    : prisma.library.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export function insertExercise(table: ExerciseTable, userId: string, exercise: ExerciseInput) {
  const data = { userId, ...exercise };
  return table === "history" ? prisma.history.create({ data }) : prisma.library.create({ data });
}

export async function deleteExercises(table: ExerciseTable, userId: string) {
  const { count } =
    table === "history"
      ? await prisma.history.deleteMany({ where: { userId } })
      : await prisma.library.deleteMany({ where: { userId } });
  return count;
}

/**
 * Delete every history row past each user's newest `limit`, ranked as
 * listExercises lists them. Returns how many rows went.
 *
 * Only users over the limit are ranked, so the cost follows the rows to delete
 * rather than the size of the table. A row inserted while this runs is newer
 * than anything ranked, so it's never the one deleted; it can leave a user one
 * over the limit until the next run.
 */
export function pruneHistory(limit = HISTORY_LIMIT) {
  return prisma.$executeRaw`
    DELETE FROM history
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id
          ORDER BY generation_num DESC, created_at DESC, id DESC
        ) AS position
        FROM history
        WHERE user_id IN (
          SELECT user_id FROM history GROUP BY user_id HAVING COUNT(*) > ${limit}
        )
      ) AS ranked
      WHERE position > ${limit}
    )`;
}
