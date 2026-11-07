import { z } from "zod";

/** A 0–100 score, as the player rounds it. */
const Score = z.number().int().min(0).max(100);

/**
 * One line of feedback under a score: where in the music it is, and what it says.
 * Right-note lines also say which note it was and what was played instead, so the
 * score card can draw the wrong note over the written one.
 */
export const ScoreNoteSchema = z.object({
  /** The bar it's about, counting from 1, or the first of a run of bars. None for the whole run. */
  bar: z.number().int().min(1).max(10_000).optional(),
  /** The last bar of a run ("Bars 2–3"). */
  endBar: z.number().int().min(1).max(10_000).optional(),
  /** The beat in the bar, counting from 1. */
  beat: z.number().int().min(1).max(64).optional(),
  text: z.string().min(1).max(300),
  /** The note's index in the exercise, rests counted, as the staff counts them. */
  index: z.number().int().min(0).max(100_000).optional(),
  /** Written pitch as a MIDI number: the note on the page, and the one played. */
  written: z.number().int().min(0).max(127).optional(),
  played: z.number().int().min(0).max(127).optional(),
  /**
   * How long the wrong note was played, in quarter notes: a note value (0.25–4), or held
   * past a whole note, whole beats (a long tone's tied last note runs to 6 or more).
   * Capped as loosely as `bar`, since a note can be held for most of the exercise.
   */
  playedLength: z.number().min(0.25).max(10_000).optional(),
});

const Feedback = z.array(ScoreNoteSchema).max(50);

/** POST /api/scores: one scored run, its columns as the table names them. */
export const ScoreInputSchema = z.object({
  exerciseId: z.uuid(),
  tempo: z.number().int().min(20).max(400),
  overall: Score,
  rightNotesScore: Score,
  rhythmScore: Score,
  intonationScore: Score,
  toneScore: Score,
  rightNotesFeedback: Feedback,
  rhythmFeedback: Feedback,
  intonationFeedback: Feedback,
  toneFeedback: Feedback,
});

export type ScoreInput = z.infer<typeof ScoreInputSchema>;
