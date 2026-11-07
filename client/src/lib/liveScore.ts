import type { PitchSample } from "./hearing";
import { heardUntil, noteCents, type Timing } from "./scoring";
import { soundingNotes, type Timeline } from "./timeline";
import {
  restartPoint,
  transcribe,
  wrongNotes,
  type GhostNote,
  type PlayedNote,
} from "./transcribe";

/**
 * What a scored run's live marks keep from one update to the next, so that each update
 * only works on what's still open: the notes played since the last restart point, and
 * the written notes whose stretch hasn't all been heard yet.
 */
export type LiveScore = {
  /** The notes played before `restartAt`, which are final, and their ghosts. */
  kept: PlayedNote[];
  keptGhosts: GhostNote[];
  /** Where transcription starts again: the start of the latest note definitely over. */
  restartAt: number;
  /**
   * Each written note's cents (by its index in `soundingNotes`), locked in once its whole
   * stretch (to `heardUntil`) has been heard. Until then it's worked out on every update.
   */
  locked: Map<number, number | null>;
  /** The marks last given, given again while they're the same, so the staff isn't redrawn. */
  ghosts: GhostNote[];
  cents: (number | null)[];
};

/** Live marks with nothing heard yet. */
export function newLiveScore(): LiveScore {
  return { kept: [], keptGhosts: [], restartAt: 0, locked: new Map(), ghosts: [], cents: [] };
}

/**
 * A take starting or resuming at `from`: everything kept from there on is thrown away,
 * as the recorder drops what was heard there too. The latest note played before `from`
 * is transcribed again, since the new take's sound may carry it on, and any written note
 * whose stretch reaches `from` is worked out again. Updates `live` in place.
 */
export function rewindLive(live: LiveScore, from: number, timeline: Timeline, beat: number) {
  const before = live.kept.filter((note) => note.end < from);
  const reopened = before.pop();
  live.kept = before;
  live.keptGhosts = wrongNotes(before, timeline);
  live.restartAt = reopened ? reopened.start : 0;
  const sounding = soundingNotes(timeline);
  for (const k of live.locked.keys()) {
    if (heardUntil(sounding[k], beat) > from) live.locked.delete(k);
  }
}

/**
 * The marks for the staff from what's been heard so far (`samples`, in order), with the
 * music heard up to `now`: the wrong notes played as ghosts, and each written note's
 * cents once it's over. Works the same as `scoreRun` and `wrongNotes` over every sample,
 * but only on what's still open: it transcribes from `live.restartAt`, moves the notes
 * now final into `live.kept`, and locks in each written note once all of it is heard.
 * Updates `live` in place.
 */
export function updateLive(
  live: LiveScore,
  samples: readonly PitchSample[],
  timeline: Timeline,
  time: Timing,
  now: number,
): { ghosts: GhostNote[]; cents: (number | null)[] } {
  // The newest frame heard: it lags the music by the frame's and the microphone's delays.
  const heardTo = samples.length ? samples[samples.length - 1].at : -Infinity;

  const open = transcribe(samples, timeline, time.secondsPerQuarter, live.restartAt);
  const over = restartPoint(open, heardTo, time.secondsPerQuarter);
  const done = open.slice(0, Math.max(0, over));
  const doneGhosts = wrongNotes(done, timeline);
  const ghosts = [
    ...live.keptGhosts,
    ...doneGhosts,
    ...wrongNotes(open.slice(done.length), timeline),
  ];
  if (over > 0) {
    live.kept.push(...done);
    live.keptGhosts.push(...doneGhosts);
    live.restartAt = open[over].start;
  }

  const cents: (number | null)[] = timeline.notes.map(() => null);
  for (const [k, note] of soundingNotes(timeline).entries()) {
    // Judged once its first written note is over; none after it is yet.
    const first = timeline.notes[note.indices[0]];
    if (first.start + first.length > now) break;
    let value = live.locked.get(k);
    if (value === undefined) {
      value = noteCents(note, samples, timeline, time);
      if (heardTo >= heardUntil(note, time.beat)) live.locked.set(k, value);
    }
    for (const i of note.indices) {
      const written = timeline.notes[i];
      if (written.start + written.length <= now) cents[i] = value;
    }
  }

  if (!sameGhosts(ghosts, live.ghosts)) live.ghosts = ghosts;
  if (!cents.every((c, i) => c === live.cents[i]) || cents.length !== live.cents.length) {
    live.cents = cents;
  }
  return { ghosts: live.ghosts, cents: live.cents };
}

function sameGhosts(a: readonly GhostNote[], b: readonly GhostNote[]) {
  return (
    a.length === b.length &&
    a.every((g, i) => g.start === b[i].start && g.length === b[i].length && g.midi === b[i].midi)
  );
}
