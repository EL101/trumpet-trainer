import { barAt, cursorAt, type Timeline } from "./timeline";

/** How the landing page's example phrase is played on a loop, in seconds and beats a minute. */
export type DemoPacing = {
  bpm: number;
  /** Silence before each run, with nothing coloured. */
  lead: number;
  /** After the last note, how long the coloured phrase stays up. */
  hold: number;
};

/** Where the loop is at a moment. */
export type DemoState = {
  /** The staff cursor (a fractional note index), or undefined between runs. */
  cursor: number | undefined;
  /** How many notes from the start have been played, and so take their colour. */
  played: number;
  /**
   * Which herald is playing: the left one plays the first half of the bars, the right one
   * answers with the rest. Null between runs.
   */
  player: "left" | "right" | null;
  /** The index of the note sounding, or null between runs and on a rest. */
  sounding: number | null;
};

/** The length of one run of the loop, in seconds. */
export function demoPeriod(timeline: Timeline, { bpm, lead, hold }: DemoPacing) {
  return lead + (timeline.end * 60) / bpm + hold;
}

/**
 * The loop's state `seconds` after it started. Each run waits `lead`, plays the phrase
 * through at `bpm`, holds it fully coloured for `hold`, then starts again from nothing.
 * Before it starts (negative `seconds`) nothing is playing.
 */
export function demoAt(timeline: Timeline, seconds: number, pacing: DemoPacing): DemoState {
  const idle: DemoState = { cursor: undefined, played: 0, player: null, sounding: null };
  if (seconds < 0 || !timeline.notes.length) return idle;

  const quarter = 60 / pacing.bpm;
  const sweep = timeline.end * quarter;
  const into = seconds % demoPeriod(timeline, pacing);
  if (into < pacing.lead) return idle;
  if (into >= pacing.lead + sweep) {
    return { ...idle, played: timeline.notes.length };
  }

  const position = (into - pacing.lead) / quarter;
  const cursor = cursorAt(timeline, position);
  const index = Math.min(timeline.notes.length - 1, Math.floor(cursor));
  return {
    cursor,
    played: index + 1,
    player: barAt(timeline, position) < timeline.bars / 2 ? "left" : "right",
    sounding: timeline.notes[index].midi == null ? null : index,
  };
}

/**
 * The valves (1–3) held down for a written pitch, given as MIDI, on a B♭ trumpet in its
 * usual range (F♯3 to C6), with the standard fingering for each note. Open notes and
 * anything out of range give an empty list.
 */
export function valvesFor(midi: number): readonly number[] {
  return VALVES_FROM_C4[midi - 60] ?? (midi >= 54 && midi < 60 ? LOW_VALVES[midi - 54] : []);
}

// From C4 up a semitone at a time to C6.
const VALVES_FROM_C4: readonly (readonly number[])[] = [
  [], // C4
  [1, 2, 3],
  [1, 3], // D4
  [2, 3],
  [1, 2], // E4
  [1], // F4
  [2],
  [], // G4
  [2, 3],
  [1, 2], // A4
  [1],
  [2], // B4
  [], // C5
  [1, 2],
  [1], // D5
  [2],
  [], // E5
  [1], // F5
  [2],
  [], // G5
  [2, 3],
  [1, 2], // A5
  [1],
  [2], // B5
  [], // C6
];

// F♯3 to B3, below the open C.
const LOW_VALVES: readonly (readonly number[])[] = [
  [1, 2, 3], // F#3
  [1, 3], // G3
  [2, 3],
  [1, 2], // A3
  [1],
  [2], // B3
];
