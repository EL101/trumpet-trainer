import { z } from "zod";
import { HORN_SPAN, MIN_RANGE_SPAN, type NoteRanges } from "../etudes/music.js";

/** A written note on the horn, as a MIDI number: F#3 (54) to G6 (91). */
const hornNote = z.number().int().min(HORN_SPAN[0]).max(HORN_SPAN[1]);

/** A range's lowest and highest note, at least an octave apart. */
const NoteSpanSchema = z
  .tuple([hornNote, hornNote])
  .refine(([low, high]) => high - low >= MIN_RANGE_SPAN, {
    message: `A range must span at least an octave (${MIN_RANGE_SPAN} semitones)`,
  });

/**
 * Body of PUT /api/settings, and what GET /api/settings returns. Every setting is
 * sent each time: the page saves them all at once.
 */
export const SettingsSchema = z.object({
  noteRanges: z.object({ LOW: NoteSpanSchema, MED: NoteSpanSchema, HIGH: NoteSpanSchema }),
});

export type Settings = { noteRanges: NoteRanges };
