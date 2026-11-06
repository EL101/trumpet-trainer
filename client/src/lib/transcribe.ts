import { heardPitch, isVoiced, type PitchSample } from "./hearing";
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
  /** Its note value, in quarter notes: 4 a whole note … 0.25 a sixteenth, dotted ones too. */
  length: number;
  /** Written pitch as a MIDI number. */
  midi: number;
};

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
const DROPOUT_SECONDS = 0.04;
/**
 * A silence up to this long, in seconds, with the same note either side is the
 * microphone losing it (a breath of noise, a dip in level), so the note carries on,
 * unless a written note starts there: then it's a tongued repeat, and a new note.
 */
const BRIDGE_SECONDS = 0.2;
/** How far, in seconds, a written note can start either side of a silence and still be what it's for. */
const ONSET_SLACK_SECONDS = 0.1;
/** Notes shorter than this, in seconds, are dropped: a crack or a stray sound. */
const SHORTEST_SECONDS = 0.08;

/**
 * Splits what the microphone heard into the notes played, in order. A note goes on
 * while its pitch holds (through blips of another note, and short drop-outs where it
 * doesn't start again for a written note), and ends at a new pitch that lasts or at a
 * silence. `samples` must be in order of `at`; the last note may still be sounding.
 * Pitches heard as a fraction of the note due (see `heardPitch`) are taken up to it.
 */
export function transcribe(
  samples: readonly PitchSample[],
  timeline: Timeline,
  secondsPerQuarter: number,
): PlayedNote[] {
  const sounding = soundingNotes(timeline);
  const due = dueNote(sounding);
  const quarters = (seconds: number) => seconds / secondsPerQuarter;
  const slack = quarters(ONSET_SLACK_SECONDS);
  const notes: PlayedNote[] = [];
  // The note being played: `last` is where its pitch was last heard, `heard` where
  // anything was (a blip of another note keeps it going, but doesn't lengthen it).
  let current: { midi: number; start: number; last: number; heard: number } | null = null;
  // Another pitch heard through the current note, until it lasts long enough to be one.
  let pending: { midi: number; start: number; last: number } | null = null;

  const close = () => {
    if (current && current.last - current.start >= quarters(SHORTEST_SECONDS)) {
      notes.push({ start: current.start, end: current.last, midi: current.midi });
    }
    current = null;
    pending = null;
  };

  for (const s of samples) {
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
    if (pending.last - pending.start >= quarters(CHANGE_SECONDS)) {
      const next = { ...pending, heard: s.at };
      current.last = Math.min(current.last, pending.start);
      close();
      current = next;
    }
  }
  close();
  return notes;
}

/** A played note written as a ghost: its start snapped to a sixteenth, its length to a note value. */
export function toGhost({ start, end, midi }: PlayedNote): GhostNote {
  const length = end - start;
  const value = NOTE_VALUES.reduce((best, v) =>
    Math.abs(Math.log(v / length)) < Math.abs(Math.log(best / length)) ? v : best,
  );
  return { start: Math.round(start * 4) / 4, length: value, midi };
}

/**
 * The ghosts to draw: each played note that isn't the note written where it sounded
 * (the one under its middle), or that sounded where a rest is written.
 */
export function wrongNotes(played: readonly PlayedNote[], timeline: Timeline): GhostNote[] {
  return played
    .filter((p) => {
      const middle = (p.start + p.end) / 2;
      const written = timeline.notes.find((n) => n.start <= middle && middle < n.start + n.length);
      return written?.midi !== p.midi;
    })
    .map(toGhost);
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
