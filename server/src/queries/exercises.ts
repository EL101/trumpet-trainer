import { prisma } from "../db.js";
import type { ExerciseInput, ExerciseTable } from "../schema/index.js";

// `history` is browsed newest-generation-first; `library` newest-saved-first.
export function listExercises(table: ExerciseTable, userId: string) {
  return table === "history"
    ? prisma.history.findMany({ where: { userId }, orderBy: { generationNum: "desc" } })
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
