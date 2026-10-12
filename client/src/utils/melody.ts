import { Note } from "tonal";
import type { Difficulty } from "@/schema";
import type { NoteEvent } from "./notate";

/**
 * How a melody moves at one difficulty. These are the numbers to tune by ear.
 *
 * - `maxLeap`: the widest leap, in semitones, between two notes in a row.
 * - `tritone`: whether a leap can be a tritone.
 * - `decay`: how fast wider intervals get rarer. A step (the next note of the scale)
 *   weighs 1, and each scale step wider multiplies that by `decay`: at 0.5, a third
 *   weighs 0.5, a fourth 0.25 and a fifth 0.125.
 * - `repeat`: the weight of playing the same note again.
 * - `edgePull`: how much the middle of the range is favoured over its edges. At 0.5 a
 *   note at the very edge is half as likely as one in the middle, at 0 they're even, and
 *   below 0 the edges are favoured (at -3 they're four times as likely).
 * - `recoverAfter`: the leap, in scale steps, from which a step back the other way can
 *   follow (3 is a fourth, 5 a sixth).
 * - `recovery`: the chance that such a leap is followed by that step back.
 */
export type MelodyStyle = {
  maxLeap: number;
  tritone: boolean;
  decay: number;
  repeat: number;
  edgePull: number;
  recoverAfter: number;
  recovery: number;
};

/** One exercise type's melody style at each difficulty. */
export type MelodyMode = Record<Difficulty, MelodyStyle>;

/** Random exercises. Steps come out about 57% of the time at low, 51% at medium, 35% at high. */
export const RANDOM_MELODY: MelodyMode = {
  // Up to a fifth.
  LOW: {
    maxLeap: 7,
    tritone: false,
    decay: 0.5,
    repeat: 0.4,
    edgePull: 0.5,
    recoverAfter: 3,
    recovery: 1,
  },
  // Up to an octave.
  MED: {
    maxLeap: 12,
    tritone: true,
    decay: 0.7,
    repeat: 0.4,
    edgePull: 0.5,
    recoverAfter: 3,
    recovery: 1,
  },
  // Up to an octave and a fifth.
  HIGH: {
    maxLeap: 19,
    tritone: true,
    decay: 0.8,
    repeat: 0.4,
    edgePull: 0.5,
    recoverAfter: 5,
    recovery: 0.6,
  },
};

/**
 * Long tones, which come in low and high difficulty only: held notes, with a repeated
 * note rarer since it only lengthens the tone. Low moves by step about 63% of the time
 * and keeps near the middle of the range; high moves by step about 44% of the time.
 */
export const LONG_TONE_MELODY: Record<"LOW" | "HIGH", MelodyStyle> = {
  // Up to a third, staying near the middle of the range.
  LOW: {
    maxLeap: 4,
    tritone: false,
    decay: 0.5,
    repeat: 0.2,
    edgePull: 0.9,
    recoverAfter: 3,
    recovery: 1,
  },
  // Up to an octave.
  HIGH: {
    maxLeap: 12,
    tritone: true,
    decay: 0.7,
    repeat: 0.2,
    edgePull: 0.5,
    recoverAfter: 4,
    recovery: 0.75,
  },
};

const TRITONE = 6;

/** Whether two notes this many semitones apart can follow each other in this style. */
export function withinLeap(semitones: number, style: MelodyStyle) {
  const leap = Math.abs(semitones);
  return leap <= style.maxLeap && (style.tritone || leap !== TRITONE);
}

/**
 * Puts a melody to a rhythm: one note for each length in `lengths` (in quarter notes),
 * each following from the ones before it (see `nextPitch`). A note is a rest instead with
 * a chance of `restChance`, except the last, which is always the tonic. Towards the end,
 * each note keeps within reach of a tonic in the leaps left, so the melody can get there.
 */
export function melody(
  lengths: readonly number[],
  pitches: readonly string[],
  tonic: string,
  style: MelodyStyle,
  restChance = 0,
): NoteEvent[] {
  const reach = tonicReach(pitches, tonic, style);
  const played: string[] = [];
  const events = lengths.map((quarters, i): NoteEvent => {
    const leapsLeft = lengths.length - 1 - i;
    const allowed = (pitch: string) => reach(leapsLeft).has(pitch);
    const pitch = Math.random() < restChance ? null : nextPitch(pitches, played, style, allowed);
    if (pitch) played.push(pitch);
    return { pitch, quarters };
  });
  // End on the tonic nearest the note before the last, even if the last was a rest.
  const last = events[events.length - 1];
  if (last.pitch) played.pop();
  last.pitch = closingTonic(pitches, tonic, played.at(-1) ?? null);
  return events;
}

/**
 * For a number of leaps, the notes from which a tonic can be reached in that many leaps
 * or fewer: the tonics themselves for 0, the notes a leap away from one for 1, and so on.
 */
function tonicReach(pitches: readonly string[], tonic: string, style: MelodyStyle) {
  const midi = (pitch: string) => Note.midi(pitch)!;
  const reach = [new Set(pitches.filter((pitch) => Note.pitchClass(pitch) === tonic))];
  return (leaps: number) => {
    while (reach.length <= leaps && reach[reach.length - 1].size < pitches.length) {
      const nearer = [...reach[reach.length - 1]];
      const next = pitches.filter((p) => nearer.some((q) => withinLeap(midi(q) - midi(p), style)));
      reach.push(new Set(next));
    }
    return reach[Math.min(leaps, reach.length - 1)];
  };
}

/**
 * The next note of a random melody over `pitches` (the key's notes in range, lowest
 * first), given the notes `played` so far. After a wide leap it may step back the other
 * way (see `MelodyStyle.recoverAfter`); otherwise it picks among the notes within the
 * style's leap, favouring small intervals and the middle of the range. Only `allowed`
 * notes are picked, unless none of them can be reached.
 */
export function nextPitch(
  pitches: readonly string[],
  played: readonly string[],
  style: MelodyStyle,
  allowed: (pitch: string) => boolean = () => true,
): string {
  const midis = pitches.map((pitch) => Note.midi(pitch)!);
  const centre = (midis[0] + midis[midis.length - 1]) / 2;
  const halfRange = (midis[midis.length - 1] - midis[0]) / 2 || 1;
  const centreWeight = (midi: number) => 1 - style.edgePull * ((midi - centre) / halfRange) ** 2;

  const last = played.length ? pitches.indexOf(played[played.length - 1]) : -1;
  const leap = played.length > 1 ? last - pitches.indexOf(played[played.length - 2]) : 0;
  const back = pitches[last - Math.sign(leap)];
  const recovers = Math.abs(leap) >= style.recoverAfter && back && allowed(back);
  if (recovers && Math.random() < style.recovery) return back;

  const weightOf = (midi: number, i: number) => {
    if (last < 0) return centreWeight(midi);
    if (!withinLeap(midi - midis[last], style)) return 0;
    const steps = Math.abs(i - last);
    const interval = steps === 0 ? style.repeat : style.decay ** (steps - 1);
    return interval * centreWeight(midi);
  };
  const weights = midis.map((midi, i) => (allowed(pitches[i]) ? weightOf(midi, i) : 0));
  return weightedPick(pitches, weights.some((w) => w > 0) ? weights : midis.map(weightOf));
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
