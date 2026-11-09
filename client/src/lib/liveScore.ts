import type { PitchSample } from "./hearing";
import { heardUntil, noteCents, type Timing } from "./scoring";
import { soundingNotes, type Timeline } from "./timeline";
import {
  BRIDGE_SECONDS,
  heldTo,
  judgePlayed,
  restartPoint,
  toMark,
  transcribe,
  type JudgedNote,
  type PlayedMark,
  type PlayedNote,
} from "./transcribe";

/**
 * What a scored run's live marks keep from one update to the next, so that each update
 * only works on what's still open: the notes played since the last restart point, and
 * the written notes whose stretch hasn't all been heard yet.
 */
export type LiveScore = {
  /** The notes played before `restartAt`, which are final, and how they were judged. */
  kept: PlayedNote[];
  keptJudged: JudgedNote[];
  /** Where transcription starts again: the start of the latest note definitely over. */
  restartAt: number;
  /**
   * Each written note's cents (by its index in `soundingNotes`), locked in once its whole
   * stretch (to `heardUntil`) has been heard. Until then it's worked out on every update.
   */
  locked: Map<number, number | null>;
  /** The marks last given, given again while they're the same, so the staff isn't redrawn. */
  played: PlayedMark[];
  cents: (number | null)[];
};

/** Live marks with nothing heard yet. */
export function newLiveScore(): LiveScore {
  return { kept: [], keptJudged: [], restartAt: 0, locked: new Map(), played: [], cents: [] };
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
  // As they were judged: each is held to the one after it, which is still where it was
  // (the note reopened starts again where it did).
  live.keptJudged = live.keptJudged.slice(0, before.length);
  live.restartAt = reopened ? reopened.start : 0;
  const sounding = soundingNotes(timeline);
  for (const k of live.locked.keys()) {
    if (heardUntil(sounding[k], beat) > from) live.locked.delete(k);
  }
}

/**
 * The marks for the staff from what's been heard so far (`samples`, in order), with the
 * music heard up to `now`: every note played, judged right or wrong once it's over (one
 * still sounding is marked so), and each written note's cents once it's over. Works the
 * same as `scoreRun` over every sample, but only on what's still open: it transcribes
 * from `live.restartAt`, moves the notes now final into `live.kept`, and locks in each
 * written note once all of it is heard. Updates `live` in place.
 *
 * `restsTo` is where silence after the last note is known to, on a sixteenth, for the
 * played staff's rests (see `silences`): BRIDGE_SECONDS before the newest frame, as a
 * silence shorter than that may yet be the note carrying on, and none while it sounds.
 */
export function updateLive(
  live: LiveScore,
  samples: readonly PitchSample[],
  timeline: Timeline,
  time: Timing,
  now: number,
): { played: PlayedMark[]; cents: (number | null)[]; restsTo: number } {
  // The newest frame heard: it lags the music by the frame's and the microphone's delays.
  const heardTo = samples.length ? samples[samples.length - 1].at : -Infinity;

  const open = transcribe(samples, timeline, time.secondsPerQuarter, live.restartAt);
  const over = restartPoint(open, heardTo, time.secondsPerQuarter);
  const judge = (p: PlayedNote, i: number) =>
    judgePlayed(p, timeline, heldTo(open, i, time.secondsPerQuarter));
  const done = open.slice(0, Math.max(0, over));
  const doneJudged = done.map(judge);
  const judged = [
    ...live.keptJudged,
    ...doneJudged,
    ...open.slice(done.length).map((p, i) => judge(p, done.length + i)),
  ];
  // The note still sounding isn't judged until it's over: it's judged by the written
  // note under its middle, which moves on as it's held, so a note played a little early
  // would be marked wrong (against the note before it), then right.
  const sounding = open.length > 0 && over !== open.length - 1;
  if (over > 0) {
    live.kept.push(...done);
    live.keptJudged.push(...doneJudged);
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

  const played = judged.map((j, i) => toMark(j, cents, sounding && i === judged.length - 1));
  if (!sameMarks(played, live.played)) live.played = played;
  if (!cents.every((c, i) => c === live.cents[i]) || cents.length !== live.cents.length) {
    live.cents = cents;
  }
  // Nothing after a note still sounding is silence: its ghost's length is rounded to a
  // note value, which can fall short of where it's been heard to.
  const silentTo = sounding
    ? played[played.length - 1].start
    : heardTo - BRIDGE_SECONDS / time.secondsPerQuarter;
  const restsTo = Math.max(0, Math.floor(silentTo * 4) / 4);
  return { played: live.played, cents: live.cents, restsTo };
}

function sameMarks(a: readonly PlayedMark[], b: readonly PlayedMark[]) {
  return (
    a.length === b.length &&
    a.every(
      (m, i) =>
        m.start === b[i].start &&
        m.length === b[i].length &&
        m.midi === b[i].midi &&
        m.status === b[i].status &&
        m.cents === b[i].cents,
    )
  );
}
