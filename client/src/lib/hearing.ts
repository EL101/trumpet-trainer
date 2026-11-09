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

/**
 * A tongue stop between fast notes can be shorter than a frame (FRAME in
 * `useRunRecorder`, about 43 ms), so no frame is silent: it shows only as a dip in
 * level. A frame at most this share as loud as the loudest within DIP_REACH_SECONDS
 * either side is the bottom of one. (Tongue stops of 15–25 ms dip to around 0.45–0.7.)
 */
const DIP_SHARE = 0.75;
const DIP_REACH_SECONDS = 0.06;

/**
 * Whether `samples[i]` (in order of `at`) is the bottom of a dip in level, as a tongue
 * stop too short for a silent frame makes: quieter than the frames either side of it, and
 * at most DIP_SHARE as loud as the loudest within DIP_REACH_SECONDS on each side. Of a
 * flat bottom, the last frame is the dip. Only frames already heard count, so one near the
 * newest frame can turn out to be a dip once more come in.
 */
export function dipAt(samples: readonly PitchSample[], i: number, secondsPerQuarter: number) {
  const s = samples[i];
  const before = samples[i - 1];
  const after = samples[i + 1];
  if (!before || !after || s.level > before.level || s.level >= after.level) return false;
  const reach = DIP_REACH_SECONDS / secondsPerQuarter;
  const loudest = (from: number, step: number) => {
    let level = 0;
    for (let j = from; j >= 0 && j < samples.length; j += step) {
      if (Math.abs(samples[j].at - s.at) > reach) break;
      level = Math.max(level, samples[j].level);
    }
    return level;
  };
  return s.level <= DIP_SHARE * loudest(i - 1, -1) && s.level <= DIP_SHARE * loudest(i + 1, 1);
}

/**
 * The index of the first sample at or after `at`, by binary search: `samples` must be in
 * order of `at`. `samples.length` if none is.
 */
export function firstFrom(samples: readonly PitchSample[], at: number) {
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].at < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
