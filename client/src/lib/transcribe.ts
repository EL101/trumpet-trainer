import { firstFrom, heardPitch, isVoiced, type PitchSample } from "./hearing";
import { soundingNotes, type SoundingNote, type Timeline } from "./timeline";

/** A note as played: what the microphone heard, split into notes. */
export type PlayedNote = {
  /** Where it started and ended, in quarter notes from the top. */
  start: number;
  end: number;
  /** Written pitch as a MIDI number. */
  midi: number;
};

/** A played note as the staff draws it: snapped to a sixteenth, with a note value. */
export type GhostNote = {
  /** Where it starts, in quarter notes from the top. */
  start: number;
  /**
   * How long it was held, in quarter notes: up to a whole note, a note value (4 a whole
   * note … 0.25 a sixteenth, dotted ones too); longer, whole beats. Drawn as tied notes
   * where it crosses a barline or no one note value fits (see `ghostPieces`).
   */
  length: number;
  /** Written pitch as a MIDI number. */
  midi: number;
};

/** One note of a ghost as written: a note value, tied to the next one if `tied`. */
export type GhostPiece = GhostNote & { tied: boolean };

/** The note values a played note is written as, in quarter notes. */
export const NOTE_VALUES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25] as const;

/** A different note has to sound this long, in seconds, before it's a new one (not a blip). */
const CHANGE_SECONDS = 0.07;
/**
 * The pitch can stray this far, in semitones, and still be the note being held: a note
 * played a little out of tune, or wavering, isn't a string of different ones.
 */
const HOLD_SEMITONES = 0.75;
/** Drop-outs this short, in seconds, are always bridged: the microphone missing a frame or two. */
export const DROPOUT_SECONDS = 0.04;
/**
 * A silence up to this long, in seconds, with the same note either side is the
 * microphone losing it (a breath of noise, a dip in level), so the note carries on,
 * unless a written note starts there: then it's a tongued repeat, and a new note.
 */
export const BRIDGE_SECONDS = 0.2;
/** How far, in seconds, a written note can start either side of a silence and still be what it's for. */
const ONSET_SLACK_SECONDS = 0.1;
/** Notes shorter than this, in seconds, are dropped: a crack or a stray sound. */
const SHORTEST_SECONDS = 0.08;
/**
 * At a fast tempo the shortest note written (a sixteenth, say) can be shorter than
 * CHANGE_SECONDS or SHORTEST_SECONDS, and would be lost: there, each is this share of it
 * instead (see `forTempo`).
 */
const SHORTEST_WRITTEN_SHARE = 0.6;
/** However fast the tempo, a sound shorter than this, in seconds, is a blip: the metronome's click. */
const BLIP_SECONDS = 0.03;

/**
 * A length in `seconds` that a note has to last, shortened at a fast tempo to a share of
 * the shortest note written (`shortestWritten`, in quarter notes) so those still count:
 * never longer than `seconds` (slow tempos, and music with no notes that short, are as
 * they were), and never shorter than BLIP_SECONDS. Only as short as the music needs: a
 * split attack (the note speaking on the partial next to it for a moment) is as long as
 * a fast sixteenth, so it would be kept as a note in music that has none.
 */
export function forTempo(seconds: number, secondsPerQuarter: number, shortestWritten: number) {
  return Math.min(
    seconds,
    Math.max(BLIP_SECONDS, shortestWritten * secondsPerQuarter * SHORTEST_WRITTEN_SHARE),
  );
}

/**
 * Splits what the microphone heard into the notes played, in order. A note goes on
 * while its pitch holds (through blips of another note, and short drop-outs where it
 * doesn't start again for a written note), and ends at a new pitch that lasts or at a
 * silence. `samples` must be in order of `at`; the last note may still be sounding.
 * Pitches heard as a fraction of the note due (see `heardPitch`) are taken up to it.
 *
 * `from` starts it partway, at a sample: from a `restartPoint`, it gives the same notes
 * from there on as transcribing every sample would.
 */
export function transcribe(
  samples: readonly PitchSample[],
  timeline: Timeline,
  secondsPerQuarter: number,
  from = 0,
): PlayedNote[] {
  const sounding = soundingNotes(timeline);
  const due = dueNote(sounding);
  const quarters = (seconds: number) => seconds / secondsPerQuarter;
  const slack = quarters(ONSET_SLACK_SECONDS);
  const shortestWritten = Math.min(...sounding.map((n) => n.length));
  const shortest = quarters(forTempo(SHORTEST_SECONDS, secondsPerQuarter, shortestWritten));
  const change = quarters(forTempo(CHANGE_SECONDS, secondsPerQuarter, shortestWritten));
  const notes: PlayedNote[] = [];
  // The note being played: `last` is where its pitch was last heard, `heard` where
  // anything was (a blip of another note keeps it going, but doesn't lengthen it).
  let current: { midi: number; start: number; last: number; heard: number } | null = null;
  // Another pitch heard through the current note, until it lasts long enough to be one.
  let pending: { midi: number; start: number; last: number } | null = null;

  const close = () => {
    if (current && current.last - current.start >= shortest) {
      notes.push({ start: current.start, end: current.last, midi: current.midi });
    }
    current = null;
    pending = null;
  };

  for (let i = firstFrom(samples, from); i < samples.length; i++) {
    const s = samples[i];
    const pitch = isVoiced(s) ? heardPitch(s.hz, due(s.at)) : null;
    if (pitch === null) continue;
    if (current) {
      const gap = s.at - current.heard;
      if (gap > quarters(DROPOUT_SECONDS)) {
        const same = Math.abs(pitch - current.midi) < HOLD_SEMITONES;
        const repeat = startsBetween(sounding, current.last - slack, s.at + slack);
        if (!same || repeat || gap > quarters(BRIDGE_SECONDS)) close();
      }
    }
    if (!current) {
      current = { midi: Math.round(pitch), start: s.at, last: s.at, heard: s.at };
      continue;
    }
    current.heard = s.at;
    if (Math.abs(pitch - current.midi) < HOLD_SEMITONES) {
      current.last = s.at;
      pending = null;
      continue;
    }
    const midi = Math.round(pitch);
    if (!pending || pending.midi !== midi) pending = { midi, start: s.at, last: s.at };
    else pending.last = s.at;
    if (pending.last - pending.start >= change) {
      const next = { ...pending, heard: s.at };
      current.last = Math.min(current.last, pending.start);
      close();
      current = next;
    }
  }
  close();
  return notes;
}

/**
 * Which of `notes` (as `transcribe` gave them) is the latest that's definitely over, as
 * an index; -1 if none is yet. A note with another after it is over, and nothing heard
 * later changes it. The last one is over once more than BRIDGE_SECONDS of silence has
 * followed it, up to `heardTo` (the newest frame heard), as anything after that starts
 * a new note.
 *
 * Transcription can start again from that note's start (`transcribe`'s `from`): it's
 * transcribed again, along with what follows, and the notes before it are final.
 */
export function restartPoint(
  notes: readonly PlayedNote[],
  heardTo: number,
  secondsPerQuarter: number,
) {
  const last = notes.length - 1;
  if (last < 0) return -1;
  if (heardTo - notes[last].end > BRIDGE_SECONDS / secondsPerQuarter) return last;
  return last - 1;
}

/**
 * A played note written as a ghost: its start snapped to a sixteenth, its length to the
 * nearest note value, or held past a whole note, to the nearest beat.
 */
export function toGhost({ start, end, midi }: PlayedNote): GhostNote {
  const length = end - start;
  const beats = Math.round(length);
  const value =
    beats > 4
      ? beats
      : NOTE_VALUES.reduce((best, v) =>
          Math.abs(Math.log(v / length)) < Math.abs(Math.log(best / length)) ? v : best,
        );
  return { start: Math.round(start * 4) / 4, length: value, midi };
}

/** Lengths this close, in quarter notes, are the same: sums of sixteenths stray only by rounding. */
const SAME_LENGTH = 1e-6;

/**
 * A ghost written as notes: split at each barline, and within a bar into the longest note
 * values that fit, each tied to the next. Stops where the music ends (`timeline.end`), as
 * the staff does; one starting there or after is a single note, as long as fits.
 */
export function ghostPieces(
  ghost: GhostNote,
  timeline: Pick<Timeline, "bar" | "end">,
): GhostPiece[] {
  const longest = (room: number) =>
    NOTE_VALUES.find((v) => v <= room + SAME_LENGTH) ?? NOTE_VALUES[NOTE_VALUES.length - 1];
  if (ghost.start >= timeline.end)
    return [{ ...ghost, length: longest(ghost.length), tied: false }];

  const end = Math.min(ghost.start + ghost.length, timeline.end);
  const pieces: GhostPiece[] = [];
  let at = ghost.start;
  while (end - at >= NOTE_VALUES[NOTE_VALUES.length - 1] - SAME_LENGTH) {
    const barEnd = (Math.floor(at / timeline.bar + SAME_LENGTH) + 1) * timeline.bar;
    const length = longest(Math.min(barEnd, end) - at);
    pieces.push({ start: at, length, midi: ghost.midi, tied: true });
    at += length;
  }
  if (!pieces.length) return [{ ...ghost, length: longest(ghost.length), tied: false }];
  pieces[pieces.length - 1].tied = false;
  return pieces;
}

/** A silence on the played staff: a rest, as long as a note value, or a whole bar's rest. */
export type RestMark = { start: number; length: number; wholeBar: boolean };

/** The rests a silence is written as, in quarter notes: a half rest down to a sixteenth. */
const REST_VALUES = [2, 1, 0.5, 0.25] as const;

/**
 * The silences in what was played, as rests: before the first note, between notes, and
 * after the last up to `to` (where the silence is known to; the music's end at most).
 * Each is split at barlines: a whole bar of silence is one whole-bar rest, and otherwise
 * each rest is the longest that fits and starts on a multiple of its own length in the
 * bar, as rests are written (two quarters, not a half, from beat 2). Silences shorter
 * than a sixteenth aren't written. `played` must be in order of `start`.
 */
export function silences(
  played: readonly GhostNote[],
  timeline: Pick<Timeline, "bar" | "end">,
  to: number,
): RestMark[] {
  const shortest = REST_VALUES[REST_VALUES.length - 1];
  const rests: RestMark[] = [];
  const fill = (from: number, until: number) => {
    let at = from;
    while (until - at >= shortest - SAME_LENGTH) {
      const barStart = Math.floor(at / timeline.bar + SAME_LENGTH) * timeline.bar;
      const barEnd = barStart + timeline.bar;
      const end = Math.min(until, barEnd);
      if (Math.abs(at - barStart) < SAME_LENGTH && end > barEnd - SAME_LENGTH) {
        rests.push({ start: at, length: timeline.bar, wholeBar: true });
        at = barEnd;
        continue;
      }
      const offset = at - barStart;
      const length =
        REST_VALUES.find(
          (v) =>
            v <= end - at + SAME_LENGTH &&
            Math.abs(offset / v - Math.round(offset / v)) < SAME_LENGTH,
        ) ?? shortest;
      rests.push({ start: at, length, wholeBar: false });
      at += length;
    }
  };
  let heard = 0;
  for (const note of played) {
    fill(heard, note.start);
    heard = Math.max(heard, note.start + note.length);
  }
  fill(heard, Math.min(to, timeline.end));
  return rests;
}

/**
 * A played note as judged: written as a ghost, with the written note it was (an index
 * into `timeline.notes`), or null if it wasn't the note written where it sounded (the one
 * under its middle) or sounded where a rest is written.
 */
export type JudgedNote = GhostNote & { written: number | null };

export function judgePlayed(p: PlayedNote, timeline: Timeline): JudgedNote {
  const middle = (p.start + p.end) / 2;
  const i = timeline.notes.findIndex((n) => n.start <= middle && middle < n.start + n.length);
  return { ...toGhost(p), written: i >= 0 && timeline.notes[i].midi === p.midi ? i : null };
}

/** A played note as the played staff draws it. */
export type PlayedMark = GhostNote & {
  /**
   * `right`: the note written where it sounded; `wrong`: another (or one where a rest
   * is written); `sounding`: still being played, so not judged yet.
   */
  status: "right" | "wrong" | "sounding";
  /** A right note's intonation: its written note's cents, once that's judged. */
  cents: number | null;
};

/**
 * A judged note as the played staff draws it, with its written note's cents from
 * `cents` (per written note, rests counted). `sounding` for one still being played.
 */
export function toMark(
  judged: JudgedNote,
  cents: readonly (number | null)[],
  sounding = false,
): PlayedMark {
  const { written, ...ghost } = judged;
  if (sounding) return { ...ghost, status: "sounding", cents: null };
  if (written === null) return { ...ghost, status: "wrong", cents: null };
  return { ...ghost, status: "right", cents: cents[written] ?? null };
}

/** The written pitch due at a place in the music: the note sounding, or the nearest one. */
function dueNote(sounding: readonly SoundingNote[]) {
  return (at: number) => {
    if (!sounding.length) return 72;
    const lo = Math.max(0, lastStartingBy(sounding, at));
    const before = sounding[lo];
    const after = sounding[lo + 1];
    if (at < before.start || !after) return before.midi;
    if (at < before.start + before.length) return before.midi;
    return at - (before.start + before.length) < after.start - at ? before.midi : after.midi;
  };
}

/** Whether a written note starts after `from` and by `to`. */
function startsBetween(sounding: readonly SoundingNote[], from: number, to: number) {
  const i = lastStartingBy(sounding, to);
  return i >= 0 && sounding[i].start > from;
}

/** The index of the last note starting at or before `at`, or -1 if none does. */
function lastStartingBy(sounding: readonly SoundingNote[], at: number) {
  let lo = -1;
  let hi = sounding.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (sounding[mid].start <= at) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
