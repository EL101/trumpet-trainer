import { CONCERT_OFFSET } from "./tuning";

/** One frame of what the microphone heard. */
export type PitchSample = {
  /** Where in the music it was heard, in quarter notes from the top. */
  at: number;
  /** The pitch heard, in Hz (concert pitch); 0 for none. */
  hz: number;
  /** How sure the pitch detector is that `hz` is a pitch, 0–1. */
  clarity: number;
  /** The frame's loudness (RMS), 0–1. */
  level: number;
};

// What counts as a note being played: a clear enough pitch, loud enough.
// (Low, as the microphone runs without the browser's automatic gain.)
const MIN_CLARITY = 0.8;
const MIN_LEVEL = 0.003;
/**
 * The lowest written note a trumpet plays (F♯3). A pitch heard below it is the detector
 * locking onto a fraction of the note (a subharmonic): it's taken back up to the
 * multiple of it nearest the note expected, if one is within SUBHARMONIC_SLACK.
 */
const LOWEST_WRITTEN = 54;
/** The highest MIDI note: a score's pitches are sent as MIDI numbers up to this. */
const HIGHEST_MIDI = 127;
const SUBHARMONIC_SLACK = 0.6;

/** The written pitch (MIDI, fractional) of a concert-pitch frequency. */
export function writtenPitch(hz: number) {
  return 69 + 12 * Math.log2(hz / 440) - CONCERT_OFFSET;
}

/**
 * The written pitch heard at `hz` while `expected` was due. Below the trumpet's range it's
 * a subharmonic, so it's taken up to its multiple nearest `expected`; null if none is near.
 */
export function heardPitch(hz: number, expected: number): number | null {
  const pitch = writtenPitch(hz);
  // Above the highest MIDI note isn't a pitch the trumpet, or a score, can hold: a frame
  // that high is no note at all.
  if (pitch >= LOWEST_WRITTEN) return Math.round(pitch) <= HIGHEST_MIDI ? pitch : null;
  let best: number | null = null;
  // Up to a tenth: past that the multiples are too close together to tell apart.
  for (let k = 2; k <= 10; k++) {
    const up = pitch + 12 * Math.log2(k);
    if (best === null || Math.abs(up - expected) < Math.abs(best - expected)) best = up;
  }
  return best !== null && Math.abs(best - expected) < SUBHARMONIC_SLACK ? best : null;
}

/** Whether a frame heard a note: a clear enough pitch, loud enough. */
export function isVoiced(s: PitchSample) {
  return s.hz > 0 && s.clarity >= MIN_CLARITY && s.level >= MIN_LEVEL;
}
