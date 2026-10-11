import { Note } from "tonal";
import type { Difficulty } from "@/schema";

/**
 * How each difficulty shapes a random melody. These are the numbers to tune by ear.
 *
 * - `maxLeap`: the widest leap, in semitones, between two notes in a row.
 * - `tritone`: whether a leap can be a tritone.
 * - `decay`: how fast wider intervals get rarer. A step weighs 1, and each scale step
 *   wider multiplies that by `decay` (Low: third 0.5, fourth 0.25, fifth 0.125).
 * - `recoverAfter`: the leap, in scale steps, from which a step back the other way can
 *   follow (3 is a fourth, 5 a sixth).
 * - `recovery`: the chance that such a leap is followed by that step back.
 */
const MELODY: Record<
  Difficulty,
  { maxLeap: number; tritone: boolean; decay: number; recoverAfter: number; recovery: number }
> = {
  // Up to a fifth.
  LOW: { maxLeap: 7, tritone: false, decay: 0.5, recoverAfter: 3, recovery: 1 },
  // Up to an octave.
  MED: { maxLeap: 12, tritone: true, decay: 0.7, recoverAfter: 3, recovery: 1 },
  // Up to an octave and a fifth.
  HIGH: { maxLeap: 19, tritone: true, decay: 0.8, recoverAfter: 5, recovery: 0.6 },
};

/** The weight of repeating the last note, against 1 for a step. */
const REPEAT_WEIGHT = 0.4;

/** How much less likely a note at the very edge of the range is than one in the middle. */
const EDGE_PULL = 0.5;

const TRITONE = 6;

/** Whether two notes this many semitones apart can follow each other at this difficulty. */
export function withinLeap(semitones: number, difficulty: Difficulty) {
  const { maxLeap, tritone } = MELODY[difficulty];
  return Math.abs(semitones) <= maxLeap && (tritone || Math.abs(semitones) !== TRITONE);
}

/**
 * The next note of a random melody over `pitches` (the key's notes in range, lowest
 * first), given the notes `played` so far. After a wide leap it usually steps back the
 * other way (see `MELODY.recoverAfter`); otherwise it picks among the notes within the
 * difficulty's leap, favouring small intervals and the middle of the range.
 */
export function nextPitch(
  pitches: readonly string[],
  played: readonly string[],
  difficulty: Difficulty,
): string {
  const midis = pitches.map((pitch) => Note.midi(pitch)!);
  const centre = (midis[0] + midis[midis.length - 1]) / 2;
  const halfRange = (midis[midis.length - 1] - midis[0]) / 2 || 1;
  const centreWeight = (midi: number) => 1 - EDGE_PULL * ((midi - centre) / halfRange) ** 2;

  const last = played.length ? pitches.indexOf(played[played.length - 1]) : -1;
  if (last < 0) return weightedPick(pitches, midis.map(centreWeight));

  const { decay, recoverAfter, recovery } = MELODY[difficulty];
  const leap = played.length > 1 ? last - pitches.indexOf(played[played.length - 2]) : 0;
  const back = last - Math.sign(leap);
  if (Math.abs(leap) >= recoverAfter && pitches[back] && Math.random() < recovery) {
    return pitches[back];
  }

  const weights = midis.map((midi, i) => {
    if (!withinLeap(midi - midis[last], difficulty)) return 0;
    const steps = Math.abs(i - last);
    const interval = steps === 0 ? REPEAT_WEIGHT : decay ** (steps - 1);
    return interval * centreWeight(midi);
  });
  return weightedPick(pitches, weights);
}

/**
 * The tonic to end on: the one nearest the note before, or nearest the middle of the
 * range if there's no note before. Never more than a fifth away.
 */
export function closingTonic(
  pitches: readonly string[],
  tonic: string,
  previous: string | null,
): string {
  const from = previous ? pitches.indexOf(previous) : (pitches.length - 1) / 2;
  const tonics = pitches.filter((pitch) => Note.pitchClass(pitch) === tonic);
  const distance = (pitch: string) => Math.abs(pitches.indexOf(pitch) - from);
  return tonics.reduce((nearest, pitch) => (distance(pitch) < distance(nearest) ? pitch : nearest));
}

/** One of `items`, chosen with probability proportional to its weight. */
function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    if (weights[i] <= 0) continue;
    r -= weights[i];
    if (r < 0) return items[i];
  }
  // Rounding can leave r a hair above 0; fall back to the last item that could be picked.
  return items[weights.findLastIndex((weight) => weight > 0)];
}
