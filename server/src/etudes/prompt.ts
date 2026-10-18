import { allowedDurations, barLength, RANGE_NOTES, type EtudeOptions } from "./music.js";

/**
 * The same for every request, so it can be tuned in one place. The reply's
 * shape is enforced by the output schema; this says what makes it good music.
 */
export const SYSTEM_PROMPT = `You write practice etudes for Bb trumpet. Each etude should be satisfying to play: it has a clear phrase structure (usually 4-bar phrases, building to a climax and coming back home), uses melodic motifs that come back and develop, has a recognisable harmonic outline in the key, and ends on the tonic.

Write for the trumpet, not for piano:
- Mostly stepwise motion and idiomatic leaps (3rds, 4ths, 5ths, octaves, arpeggios). Avoid awkward large leaps, especially upward into the top of the range.
- Spend most of the time in the middle of the range. Use the highest notes only briefly, and approach them by step or arpeggio.
- Leave room to breathe: a rest or a long note at least every 4 bars.
- Don't stay in the upper register for long stretches.
- Vary the rhythm. Don't build every bar from the same figure.

All pitches are WRITTEN pitch for Bb trumpet, in scientific pitch notation, with "b" for flat and "#" for sharp: "Bb4", "F#5", "C6". Middle C is C4. Spell accidentals to suit the key. Every pitch must be inside the given range.

Durations are in quarter notes: 4 = whole, 3 = dotted half, 2 = half, 1.5 = dotted quarter, 1 = quarter, 0.75 = dotted eighth, 0.5 = eighth, 0.25 = sixteenth. Use only the durations allowed for the difficulty. A rest has "pitch": null.

Reply with one array per bar. The durations in each bar must add up to exactly the bar length given. Notes do not cross bar lines.`;

const DIFFICULTY_NAMES = { LOW: "beginner", MED: "intermediate", HIGH: "advanced" } as const;

/**
 * The request for one etude. `focus` is for things to work on that come from
 * the player's own practice, one instruction per entry; nothing passes it yet.
 */
export function userMessage(options: EtudeOptions, focus: readonly string[] = []): string {
  const [low, high] = RANGE_NOTES[options.noteRange];
  const lines = [
    `Key: ${options.musicKey}`,
    `Time signature: ${options.timeSig} (each bar is ${barLength(options.timeSig)} quarter notes long)`,
    `Length: ${options.measures} bars`,
    `Range: ${low} to ${high}`,
    `Difficulty: ${DIFFICULTY_NAMES[options.difficulty]}. Allowed durations: ${allowedDurations(options.difficulty, options.timeSig).join(", ")}.`,
  ];
  if (options.character) lines.push(`Character: ${options.character}.`);
  if (focus.length > 0) {
    lines.push("", "Work on these, from the player's recent practice:");
    lines.push(...focus.map((f) => `- ${f}`));
  }
  return lines.join("\n");
}

/** Sent back with the first attempt when it fails the checks. */
export function fixMessage(problems: readonly string[]): string {
  return [
    "This etude has problems:",
    ...problems.map((p) => `- ${p}`),
    "Write the whole etude again with these fixed.",
  ].join("\n");
}
