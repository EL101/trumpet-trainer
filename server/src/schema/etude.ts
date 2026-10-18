import { z } from "zod";
import {
  DIFFICULTIES,
  KEY_PATTERN,
  RANGES,
  TIME_SIGNATURES,
  type EtudeOptions,
} from "../etudes/music.js";

/** Bars an etude can be. Longer etudes cost more and take longer to write. */
export const ETUDE_MEASURES = { min: 4, max: 16, default: 8 } as const;

/** Moods an etude can be asked for. A fixed list, so user text never reaches the prompt. */
export const ETUDE_CHARACTERS = ["lyrical", "march", "technical", "dance"] as const;

/** Body of POST /api/etudes. */
export const EtudeRequestSchema = z.object({
  musicKey: z.string().regex(KEY_PATTERN, "Expected a key like 'Bb major' or 'G minor'"),
  timeSig: z.enum(TIME_SIGNATURES),
  measures: z
    .number()
    .int()
    .min(ETUDE_MEASURES.min)
    .max(ETUDE_MEASURES.max)
    .default(ETUDE_MEASURES.default),
  noteRange: z.enum(RANGES),
  difficulty: z.enum(DIFFICULTIES),
  character: z.enum(ETUDE_CHARACTERS).optional(),
}) satisfies z.ZodType<EtudeOptions, unknown>;

export type EtudeRequest = z.infer<typeof EtudeRequestSchema>;
