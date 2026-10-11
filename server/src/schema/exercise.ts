import { z } from "zod";
import { ExerciseType } from "../generated/prisma/enums.js";

/**
 * Shape of an exercise as accepted by POST /api/history and POST /api/library.
 * Both tables store the same columns, so both routes validate against this.
 */
export const ExerciseInputSchema = z.object({
  // Any value outside the database enum is a 400. A missing type is taken as
  // RANDOM: clients built before the column existed don't send one, and random
  // exercises were all they could make.
  exerciseType: z.enum(ExerciseType).default(ExerciseType.RANDOM),
  notes: z.string().min(1),
  timeSig: z.string(),
  musicKey: z.string(),
  noteRange: z.string(),
  difficulty: z.string(),
  generationNum: z.number().int().positive(),
});

export type ExerciseInput = z.infer<typeof ExerciseInputSchema>;

/** Tables that hold exercise rows. Used to build table-scoped queries. */
export const EXERCISE_TABLES = ["history", "library"] as const;
export type ExerciseTable = (typeof EXERCISE_TABLES)[number];
