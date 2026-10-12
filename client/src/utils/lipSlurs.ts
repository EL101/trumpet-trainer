import { Note } from "tonal";
import type { Difficulty, Range } from "@/schema";
import { RANGE_NOTES } from "./generateMusic";
import { reachOf } from "./melody";
import { barLength } from "./notate";
import { isCompound } from "./rhythm";

/**
 * The partials lip slurs use, as intervals above the 2nd partial: the 2nd to the 12th
 * (C4 G4 C5 E5 G5 C6 D6 E6 G6 on the open horn), leaving out the 7th and 11th, which are
 * too far out of tune to slur to. Partials next to each other here are a partial apart.
 */
const PARTIALS = ["1P", "5P", "8P", "10M", "12P", "15P", "16M", "17M", "19P"];

/** The partials that sound the series' root (C on the open horn): the 2nd, 4th and 8th. */
const ROOT_PARTIALS = [0, 2, 5];

/**
 * Each valve combination's 2nd partial, which its whole series is spelled from: the notes
 * on 2 take sharps (B, F#, D#), the notes on 23 flats (Ab, Eb, C).
 */
const SERIES_ROOTS = {
  "0": "C4",
  "2": "B3",
  "1": "Bb3",
  "12": "A3",
  "23": "Ab3",
  "13": "G3",
  "123": "F#3",
} as const;
export type Fingering = keyof typeof SERIES_ROOTS;
/** From open down, each a half step lower than the one before. */
const VALVE_ORDER: Fingering[] = ["0", "2", "1", "12", "23", "13", "123"];
/** Fewest valves first, which is also the order a player reaches for them. */
const FINGERING_NAMES: Fingering[] = ["0", "1", "2", "12", "13", "23", "123"];

/** Each fingering's notes, one per partial, spelled from its root. */
const SERIES = Object.fromEntries(
  VALVE_ORDER.map((f) => [
    f,
    PARTIALS.map((interval) => Note.transpose(SERIES_ROOTS[f], interval)),
  ]),
) as Record<Fingering, string[]>;
const SERIES_MIDI = Object.fromEntries(
  VALVE_ORDER.map((f) => [f, SERIES[f].map((pitch) => Note.midi(pitch)!)]),
) as Record<Fingering, number[]>;

/**
 * How many partials apart the notes of a slur on one fingering can be, at each
 * difficulty, and how fast wider ones get rarer: each partial further than `min` weighs
 * `decay` times as much.
 */
const SLUR_PARTIALS: Record<Difficulty, { min: number; max: number; decay: number }> = {
  LOW: { min: 1, max: 1, decay: 1 }, // the next partial: G4 to C5
  MED: { min: 1, max: 2, decay: 1 }, // one or two: G4 to C5 or E5
  // Two or more: G4 to E5, C4 to C5. Two apart comes out about 30% of the time in the
  // Any range (about 40% in the narrower ones, which leave fewer partials to go to), and
  // very wide slurs rarer than they would be at random.
  HIGH: { min: 2, max: Infinity, decay: 0.9 },
};

/**
 * The share of moves that change fingering by choice. Coming home to the starting
 * fingering forces a few more near the end, so about 10% of moves change fingering in
 * all, and the rest slur on one fingering.
 */
const PLANNED_CHANGES = 0.075;

/**
 * How often a change of fingering aims to move onto the partial above or below, rather
 * than stay on the same partial (a half step). Low always stays; medium moves about half
 * the time; high moves whenever it can, about 80% of the time in the Medium range. Low on
 * the horn the partials are too far apart for a move within a third, so in the Low range
 * it's about a third of the time at medium and high alike.
 */
const CHANGE_LEAPS: Record<Difficulty, number> = { LOW: 0, MED: 0.5, HIGH: 1 };

/** The widest a change of fingering onto another partial can move: a major third. */
const MAX_CHANGE_LEAP = 4;

/** A note of a lip slur, with the fingering and partial (an index into `PARTIALS`) it's played on. */
export type PlannedNote = { pitch: string; midi: number; fingering: Fingering; partial: number };

/** Which partial (an index into `PARTIALS`) a fingering plays a note on, if any. */
function partialOn(pitch: string, fingering: Fingering): number | null {
  const partial = SERIES_MIDI[fingering].indexOf(Note.midi(pitch)!);
  return partial < 0 ? null : partial;
}

/** How many partials apart two notes are on each fingering that plays both. */
export function partialDistances(a: string, b: string): number[] {
  return FINGERING_NAMES.flatMap((fingering) => {
    const [pa, pb] = [partialOn(a, fingering), partialOn(b, fingering)];
    return pa === null || pb === null ? [] : [Math.abs(pa - pb)];
  });
}

/**
 * How many partials apart two notes are on the fingering that brings them closest, or
 * null if no one fingering plays both (so moving between them changes fingering).
 */
export function partialsApart(a: string, b: string): number | null {
  const apart = partialDistances(a, b);
  return apart.length ? Math.min(...apart) : null;
}

/** One of `items`, chosen with probability proportional to its weight. */
function weightedElement<T>(items: readonly T[], weight: (item: T) => number): T {
  const weights = items.map(weight);
  let r = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

function randomElement<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * How lip slurs in a meter are laid out: quarters, or eighths in compound meters (6/8,
 * 9/8, 12/8 and 3/8), and where a group starts, which is the only place the fingering
 * changes by choice: each bar, or each beat in a compound meter.
 */
function layout(timeSig: string) {
  const compound = isCompound(timeSig);
  const perBar = barLength(timeSig) / (compound ? 0.5 : 1);
  return { value: compound ? "8" : "q", perBar, groupSize: compound ? 3 : perBar };
}

/**
 * The notes of a lip-slur exercise over the bars asked for, each with the fingering and
 * partial it's played on. There's no key: each note is spelled from its fingering's
 * series. About 90% of moves slur to another note on the same fingering, as far as the
 * difficulty sets (the next partial at low, one or two at medium, two or more at high;
 * see `SLUR_PARTIALS`). The rest change to the next valve combination up or down: on the
 * same partial, a half step away, or at medium and high also onto the partial above or
 * below if that's no more than a third away (see `CHANGE_LEAPS`). Fingering changes come
 * only at the start of a bar (a beat in compound meters), so each group of notes stays on
 * one fingering. It starts in the middle half of the range and comes home at the end, to
 * the root of the fingering it started on (a C on open, a B♭ on 1), or to another note
 * on that fingering if no root fits.
 */
export function planLipSlurs(
  bars: number,
  timeSig: string,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
): PlannedNote[] {
  const { perBar, groupSize } = layout(timeSig);
  // Changes can only come once a group, so they're likelier there to make up the share.
  const changeChance = Math.min(1, PLANNED_CHANGES * groupSize);
  const { min, max, decay } = SLUR_PARTIALS[difficulty];
  const [low, high] = RANGE_NOTES[range].map((note) => Note.midi(note)!);
  const notes: PlannedNote[] = VALVE_ORDER.flatMap((fingering) =>
    SERIES[fingering].map((pitch, partial) => ({
      pitch,
      fingering,
      partial,
      midi: SERIES_MIDI[fingering][partial],
    })),
  ).filter((note) => note.midi >= low && note.midi <= high);

  /** For each note, the notes `rule` lets it move to, worked out once. */
  const movesBy = (rule: (a: PlannedNote, b: PlannedNote) => boolean) =>
    new Map(notes.map((a) => [a, new Set(notes.filter((b) => rule(a, b)))]));
  const slursFrom = movesBy((a, b) => {
    const apart = Math.abs(a.partial - b.partial);
    return a.fingering === b.fingering && apart >= min && apart <= max;
  });
  const changesFrom = movesBy((a, b) => {
    const valvesApart = Math.abs(
      VALVE_ORDER.indexOf(a.fingering) - VALVE_ORDER.indexOf(b.fingering),
    );
    if (valvesApart !== 1) return false;
    if (a.partial === b.partial) return true;
    const leap =
      Math.abs(a.partial - b.partial) === 1 && Math.abs(a.midi - b.midi) <= MAX_CHANGE_LEAP;
    return leap && difficulty !== "LOW";
  });

  const total = bars * perBar;
  const centre = (low + high) / 2;
  const middle = (note: PlannedNote) => Math.abs(note.midi - centre) <= (high - low) / 4;
  const start = () => {
    // Any fingering can start. Aim for its roots to end on, or any of its notes if no
    // start can reach a root in exactly the moves there are.
    for (const fingering of shuffled(VALVE_ORDER)) {
      const own = notes.filter((note) => note.fingering === fingering);
      const roots = own.filter((note) => ROOT_PARTIALS.includes(note.partial));
      for (const targets of [roots, own]) {
        // A change lands where it can slur on from (so it doesn't force another change
        // straight away), or on the last note.
        const canChange = (a: PlannedNote, b: PlannedNote) =>
          changesFrom.get(a)!.has(b) && (slursFrom.get(b)!.size > 0 || targets.includes(b));
        const reach = reachOf(
          notes,
          targets,
          (a, b) => slursFrom.get(a)!.has(b) || canChange(a, b),
        );
        const starts = own.filter(
          (note) => slursFrom.get(note)!.size > 0 && reach(total - 1).has(note),
        );
        if (starts.length) {
          const first = randomElement(
            starts.filter(middle).length ? starts.filter(middle) : starts,
          );
          return { first, reach, canChange };
        }
      }
    }
    throw new Error(`No lip slur fits ${bars} bars of ${timeSig} in the ${range} range`);
  };

  const { first, reach, canChange } = start();
  const played = [first];
  let changesMade = 0;
  let leapsMade = 0;
  // Changes forced where no slur fits; each one stands in for the next planned change.
  let forced = 0;
  for (let i = 1; i < total; i++) {
    // Towards the end, keep within reach of a root in the moves left.
    const inReach = (note: PlannedNote) => reach(total - 1 - i).has(note);
    const previous = played[i - 1];
    let wantsChange = i % groupSize === 0 && Math.random() < changeChance;
    if (wantsChange && forced > 0) {
      forced--;
      wantsChange = false;
    }
    const slurs = [...slursFrom.get(previous)!].filter(inReach);
    const changes = notes.filter((note) => inReach(note) && canChange(previous, note));
    if (slurs.length && !(wantsChange && changes.length)) {
      played.push(
        weightedElement(
          slurs,
          (note) => decay ** (Math.abs(note.partial - previous.partial) - min),
        ),
      );
      continue;
    }
    // The previous note is in reach of a root, so if no slur is, a change is.
    if (!wantsChange) forced++;
    const leaps = changes.filter((note) => note.partial !== previous.partial);
    const halfSteps = changes.filter((note) => note.partial === previous.partial);
    // A move to another partial is often not on offer, so aim for CHANGE_LEAPS across the
    // exercise: one gets likelier the further behind they are.
    const owed = CHANGE_LEAPS[difficulty] * (changesMade + 1) - leapsMade;
    const leap = leaps.length > 0 && (halfSteps.length === 0 || Math.random() < owed);
    played.push(randomElement(leap ? leaps : halfSteps));
    changesMade++;
    if (leap) leapsMade++;
  }
  return played;
}

/**
 * Lip slurs, all quarter notes (eighths in compound meters), over the bars asked for,
 * with a slur over each bar. Written without a key: see `planLipSlurs`.
 */
export function generateLipSlurs(
  bars: number,
  timeSig: string,
  range: Range = "MED",
  difficulty: Difficulty = "LOW",
) {
  const { value, perBar } = layout(timeSig);
  return planLipSlurs(bars, timeSig, range, difficulty)
    .map(({ pitch }, i) => {
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
