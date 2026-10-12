import { Note, Scale } from "tonal";
import type { Difficulty, Key, Range } from "@/schema";
import { scaleNotesInRange } from "./generateMusic";
import { tonicReach } from "./melody";
import { barLength } from "./notate";
import { isCompound } from "./rhythm";

/**
 * The open horn's partials that lip slurs use, as written MIDI pitches: the 2nd to the
 * 12th (C4 G4 C5 E5 G5 C6 D6 E6 G6), leaving out the 7th and 11th, which are too far out
 * of tune to slur to. Notes next to each other here are a partial apart.
 */
const OPEN_PARTIALS = ["C4", "G4", "C5", "E5", "G5", "C6", "D6", "E6", "G6"].map(
  (pitch) => Note.midi(pitch)!,
);

/** The valve combinations, each with how many semitones it lowers the open horn. */
const FINGERINGS = { "0": 0, "2": 1, "1": 2, "12": 3, "23": 4, "13": 5, "123": 6 } as const;
type Fingering = keyof typeof FINGERINGS;
/** Fewest valves first, which is also the order a player reaches for them. */
const FINGERING_NAMES: Fingering[] = ["0", "1", "2", "12", "13", "23", "123"];

/** How many partials apart the notes of a slur on one fingering can be, at each difficulty. */
const PARTIAL_LEAP: Record<Difficulty, number> = { LOW: 1, MED: 2, HIGH: Infinity };

/** The share of moves that change fingering. The rest slur on one fingering. */
const CHANGE_SHARE = 0.1;

/**
 * How often a change of fingering aims to move by a third rather than a step. Neither is
 * always on offer (many thirds share a fingering), so these aim past the shares wanted,
 * which come out about 25% thirds at low, 50% at medium and 70% at high; at high, a third
 * is taken whenever there is one.
 */
const CHANGE_THIRDS: Record<Difficulty, number> = { LOW: 0.15, MED: 0.7, HIGH: 1 };

/** Which partial (an index into `OPEN_PARTIALS`) a fingering plays a note on, if any. */
function partialOn(pitch: string, fingering: Fingering): number | null {
  const partial = OPEN_PARTIALS.indexOf(Note.midi(pitch)! + FINGERINGS[fingering]);
  return partial < 0 ? null : partial;
}

/**
 * How many partials apart two notes are on the fingering that brings them closest, or
 * null if no one fingering plays both (so moving between them changes fingering).
 */
export function partialsApart(a: string, b: string): number | null {
  const apart = FINGERING_NAMES.flatMap((fingering) => {
    const [pa, pb] = [partialOn(a, fingering), partialOn(b, fingering)];
    return pa === null || pb === null ? [] : [Math.abs(pa - pb)];
  });
  return apart.length ? Math.min(...apart) : null;
}

function randomElement<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Lip slurs, all quarter notes (eighths in 6/8, 9/8, 12/8 and 3/8), over the bars asked
 * for, every note in the key and range, with a slur over each bar. About 90% of moves
 * slur to another note on the same fingering, as far as the difficulty allows (the next
 * partial at low, two at medium, any at high); the rest change fingering by a step or a
 * third (see `CHANGE_THIRDS`). Fingering changes come only at the start of a bar (a
 * beat in compound meters), so each group of notes stays on one fingering. The last note
 * is the tonic.
 */
export function generateLipSlurs(
  bars: number,
  timeSig: string,
  key: Key,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const compound = isCompound(timeSig);
  const value = compound ? "8" : "q";
  const perBar = barLength(timeSig) / (compound ? 0.5 : 1);
  const groupSize = compound ? 3 : perBar;
  // Changes can only come once a group, so they're likelier there to make up the share.
  const changeChance = Math.min(1, CHANGE_SHARE * groupSize);
  const leap = PARTIAL_LEAP[difficulty];
  const pitches = scaleNotesInRange(key, range);
  const scaleSteps = (a: string, b: string) => Math.abs(pitches.indexOf(a) - pitches.indexOf(b));

  /** The notes a slur on `fingering` can go to from `pitch`. */
  const slursFrom = (pitch: string, fingering: Fingering) => {
    const from = partialOn(pitch, fingering)!;
    return pitches.filter((p) => {
      const to = partialOn(p, fingering);
      return p !== pitch && to !== null && Math.abs(to - from) <= leap;
    });
  };
  /** The fingerings `pitch` can slur somewhere from. */
  const slurrableOn = (pitch: string) =>
    FINGERING_NAMES.filter((f) => partialOn(pitch, f) !== null && slursFrom(pitch, f).length);
  /** A fingering for `pitch`, preferring ones it can slur somewhere from. */
  const fingeringFor = (pitch: string) => {
    const slurrable = slurrableOn(pitch);
    if (slurrable.length) return randomElement(slurrable);
    return randomElement(FINGERING_NAMES.filter((f) => partialOn(pitch, f) !== null));
  };
  const tonic = Scale.get(key).tonic!;
  const isSlur = (a: string, b: string) => {
    const apart = partialsApart(a, b);
    return a !== b && apart !== null && apart <= leap;
  };
  // A change of fingering is a step or a third, onto a note that can slur on from there
  // (so it doesn't force another change straight away), or onto the tonic to end.
  const isChange = (a: string, b: string) =>
    partialsApart(a, b) === null &&
    [1, 2].includes(scaleSteps(a, b)) &&
    (slurrableOn(b).length > 0 || Note.pitchClass(b) === tonic);
  const reach = tonicReach(pitches, tonic, (a, b) => isSlur(a, b) || isChange(a, b));

  const total = bars * perBar;
  const played: string[] = [];
  let fingering: Fingering | null = null;
  let changesMade = 0;
  let thirdsMade = 0;
  // Changes forced where no slur fits; each one stands in for the next planned change.
  let forced = 0;
  for (let i = 0; i < total; i++) {
    // Towards the end, keep within reach of a tonic in the moves left.
    const inReach = (pitch: string) => reach(total - 1 - i).has(pitch);
    const previous = played.at(-1);
    let next: string;
    if (!previous || !fingering) {
      // Start somewhere it can slur from, in the middle half of the range if it can.
      const starts = pitches.filter((p) => inReach(p) && slurrableOn(p).length > 0);
      const quarter = pitches.length / 4;
      const middle = starts.filter((p) => Math.abs(pitches.indexOf(p) - 2 * quarter) <= quarter);
      next = randomElement(middle.length ? middle : starts);
      fingering = null;
    } else {
      let wantsChange = i % groupSize === 0 && Math.random() < changeChance;
      if (wantsChange && forced > 0) {
        forced--;
        wantsChange = false;
      }
      const slurs = slursFrom(previous, fingering).filter(inReach);
      const changes = pitches.filter((p) => inReach(p) && isChange(previous, p));
      if (slurs.length && !(wantsChange && changes.length)) {
        next = randomElement(slurs);
      } else if (changes.length) {
        if (!wantsChange) forced++;
        const thirds = changes.filter((p) => scaleSteps(previous, p) === 2);
        const steps = changes.filter((p) => scaleSteps(previous, p) === 1);
        // Thirds are often not on offer (many share a fingering), so aim for CHANGE_THIRDS
        // across the exercise: a third gets likelier the further behind they are.
        const owed = CHANGE_THIRDS[difficulty] * (changesMade + 1) - thirdsMade;
        const third = thirds.length > 0 && (steps.length === 0 || Math.random() < owed);
        next = randomElement(third ? thirds : steps);
        changesMade++;
        if (third) thirdsMade++;
        fingering = null;
      } else {
        // Neither fits in reach of the tonic: slur on another of the note's fingerings.
        next = randomElement(pitches.filter((p) => inReach(p) && isSlur(previous, p)));
        fingering = null;
      }
    }
    fingering ??= fingeringFor(next);
    played.push(next);
  }

  return played
    .map((pitch, i) => {
      const open = i % perBar === 0 ? "(" : "";
      const close = i % perBar === perBar - 1 ? ")" : "";
      return `${open}${pitch}/${value}${close}`;
    })
    .join(", ");
}

/**
 * Fingering labels for a lip-slur exercise, one per note, for printing under the staff:
 * the valve combination ("0" for open) where the fingering changes and where each slur
 * starts, and "" under the notes in between, which keep it. A note keeps the fingering of
 * the note before when that plays it too (so a run slurred on one fingering keeps it);
 * otherwise it takes the fingering that plays the longest run from it, and the usual one
 * of those on a tie (B4 on 2, D5 on 1). Rests get "".
 */
export function lipSlurFingerings(notes: string): string[] {
  const tokens = notes.split(", ").map((token) => token.trim());
  const pitches = tokens.map((token) => {
    const body = token.replace(/^\(/, "").replace(/[~)]+$/, "");
    return body.includes("/r") ? null : body.split("/")[0];
  });
  const plays = (i: number, fingering: Fingering) =>
    pitches[i] !== null && partialOn(pitches[i]!, fingering) !== null;
  const runFrom = (i: number, fingering: Fingering) => {
    let length = 0;
    while (i + length < pitches.length && plays(i + length, fingering)) length++;
    return length;
  };

  let current: Fingering | null = null;
  return tokens.map((token, i) => {
    if (pitches[i] === null) return "";
    const previous = current;
    if (!current || !plays(i, current)) {
      // FINGERING_NAMES puts the usual fingering first, and a tie keeps the first.
      const options = FINGERING_NAMES.filter((f) => plays(i, f));
      current = options.length
        ? options.reduce((best, f) => (runFrom(i, f) > runFrom(i, best) ? f : best))
        : null;
    }
    return current && (current !== previous || token.startsWith("(")) ? current : "";
  });
}
