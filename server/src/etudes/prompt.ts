import {
  allowedDurations,
  barLength,
  DIFFICULTY_TARGETS,
  intervalName,
  RANGE_NOTES,
  type Difficulty,
  type EtudeOptions,
} from "./music.js";

/**
 * The same for every request, so it can be tuned in one place. The reply's
 * shape is enforced by the output schema; this says what makes it good music.
 */
export const SYSTEM_PROMPT = `You write practice etudes for Bb trumpet. Each etude should be satisfying to play: it has a clear phrase structure (usually 4-bar phrases, building to a climax and coming back home), uses melodic motifs that come back and develop, has a recognisable harmonic outline in the key, and ends on the tonic.

Write for the trumpet, not for piano:
- Leaps should be ones a trumpeter practises: 4ths, 5ths, octaves and arpeggios through the harmony. Approach the very top of the range by step or arpeggio rather than by a blind leap from far below.
- Leave room to breathe: a rest or a long note at least every 4 bars.
- After a passage high in the range, give the lips a moment lower down.
- Vary the rhythm. Don't build every bar from the same figure.

How hard to make it is set by the difficulty in the request, which lists targets the etude must meet. Meet every one of them: an etude marked advanced that plays like an intermediate one is a failure, even if it sounds nice.

All pitches are WRITTEN pitch for Bb trumpet, in scientific pitch notation, with "b" for flat and "#" for sharp: "Bb4", "F#5", "C6". Middle C is C4. Spell accidentals to suit the key. Every pitch must be inside the given range.

Durations are in quarter notes: 4 = whole, 3 = dotted half, 2 = half, 1.5 = dotted quarter, 1 = quarter, 0.75 = dotted eighth, 0.5 = eighth, 0.25 = sixteenth. Use only the durations allowed for the difficulty. A rest has "pitch": null.

Reply with one array per bar. The durations in each bar must add up to exactly the bar length given. Notes do not cross bar lines.`;

const DIFFICULTY_NAMES = { LOW: "beginner", MED: "intermediate", HIGH: "advanced" } as const;

/** What each difficulty asks of the player, beyond the counted targets. */
const DIFFICULTY_CHARACTER: Record<Difficulty, string> = {
  LOW: "Keep it approachable: mostly stepwise, with long notes, simple rhythms and plenty of rests.",
  MED: "Give it some challenge: eighth-note passages, dotted rhythms, arpeggios and leaps across the range.",
  HIGH: "Make it genuinely demanding for an advanced player: fast sixteenth runs, syncopation, wide leaps and arpeggios across the whole range, chromatic notes, and long phrases that test endurance.",
};

/** The difficulty's targets as lines for the prompt. Only the ones it sets are listed. */
function difficultyLines(options: EtudeOptions): string[] {
  const t = DIFFICULTY_TARGETS[options.difficulty];
  const sixteenths = allowedDurations(options.difficulty, options.timeSig).includes(0.25);
  const lines = [
    t.minShortShare > 0 &&
      `At least ${t.minShortShare * 100}% of the notes are eighths or shorter.`,
    sixteenths &&
      t.minSixteenths > 0 &&
      `At least ${t.minSixteenths} sixteenths or dotted eighths, mostly in runs.`,
    t.minLeaps > 0 &&
      `At least ${t.minLeaps} leaps of a 4th or more, ${t.minWideLeaps} of them a 5th or wider.`,
    `No leap wider than ${intervalName(t.maxLeap)}.`,
    `The lowest and highest notes are at least ${intervalName(t.minSpan)} apart.`,
    t.minChromatic > 0 && `At least ${t.minChromatic} notes outside the key (accidentals).`,
  ];
  return lines.filter((line): line is string => typeof line === "string");
}

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
    `Difficulty: ${DIFFICULTY_NAMES[options.difficulty]}. ${DIFFICULTY_CHARACTER[options.difficulty]}`,
    `Allowed durations: ${allowedDurations(options.difficulty, options.timeSig).join(", ")}.`,
    "Targets:",
    ...difficultyLines(options).map((line) => `- ${line}`),
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
