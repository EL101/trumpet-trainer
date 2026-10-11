import { prisma } from "../db.js";
import type { ExerciseInput, ExerciseTable, HistoryInput } from "../schema/index.js";
import { retryOnConflict } from "./conflicts.js";

/** History rows kept per user. The library has no limit. */
export const HISTORY_LIMIT = 100;

// `history` is browsed newest-generation-first, and only its newest
// HISTORY_LIMIT rows are listed; `library` is browsed newest-saved-first.
export function listExercises(table: ExerciseTable, userId: string) {
  return table === "history"
    ? prisma.history.findMany({
        where: { userId },
        orderBy: { generationNum: "desc" },
        take: HISTORY_LIMIT,
      })
    : prisma.library.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/**
 * Save a history row, numbered by the server: one past the user's highest
 * generation, so the first save after a clear is No. 1. Two saves that pick the
 * same number collide on the unique index, and the loser picks again.
 *
 * Clients built before the server numbered history send their own number. It
 * is stored as sent, and saving it again returns the row already there with
 * `created: false`, so their repeat saves stay harmless until they reload.
 */
export async function insertHistory(userId: string, input: HistoryInput) {
  const { generationNum, ...exercise } = input;

  if (generationNum !== undefined) {
    // INSERT ... ON CONFLICT DO NOTHING RETURNING *: a conflict returns no row.
    const [row] = await prisma.history.createManyAndReturn({
      data: { userId, generationNum, ...exercise },
      skipDuplicates: true,
    });
    if (row) return { row, created: true };
    const existing = await prisma.history.findUniqueOrThrow({
      where: { userId_generationNum: { userId, generationNum } },
    });
    return { row: existing, created: false };
  }

  const row = await retryOnConflict(async () => {
    const { _max } = await prisma.history.aggregate({
      where: { userId },
      _max: { generationNum: true },
    });
    return prisma.history.create({
      data: { userId, generationNum: (_max.generationNum ?? 0) + 1, ...exercise },
    });
  });
  return { row, created: true };
}

/** Save an exercise to the library. Repeats are allowed: clearing history reuses numbers. */
export function insertLibrary(userId: string, exercise: ExerciseInput) {
  return prisma.library.create({ data: { userId, ...exercise } });
}

export async function deleteExercises(table: ExerciseTable, userId: string) {
  const { count } =
    table === "history"
      ? await prisma.history.deleteMany({ where: { userId } })
      : await prisma.library.deleteMany({ where: { userId } });
  return count;
}

/** Excess rows fetched and deleted per round trip while pruning one user. */
const PRUNE_BATCH = 1000;

/**
 * Delete every history row past each user's newest `limit`, the rows
 * listExercises never returns. Returns how many rows went.
 *
 * Only users over the limit are visited, so the cost follows the rows to delete
 * rather than the size of the table. Each batch deletes the exact rows it found
 * past the limit, not everything below a cutoff, so a row saved meanwhile (even
 * a No. 1 re-saved after a clear) is never caught up in it.
 */
export async function pruneHistory(limit = HISTORY_LIMIT, batch = PRUNE_BATCH) {
  const over = await prisma.history.groupBy({
    by: ["userId"],
    having: { userId: { _count: { gt: limit } } },
  });

  let deleted = 0;
  for (const { userId } of over) {
    for (;;) {
      const excess = await prisma.history.findMany({
        where: { userId },
        orderBy: { generationNum: "desc" },
        skip: limit,
        take: batch,
        select: { id: true },
      });
      if (excess.length === 0) break;

      const { count } = await prisma.history.deleteMany({
        where: { id: { in: excess.map((row) => row.id) } },
      });
      deleted += count;
      if (excess.length < batch) break;
    }
  }
  return deleted;
}
