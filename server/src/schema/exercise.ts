import { z } from "zod";

/**
 * Shape of an exercise as accepted by POST /api/history and POST /api/library.
 * Both tables store the same columns, so both routes validate against this.
 */
export const ExerciseInputSchema = z.object({
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
