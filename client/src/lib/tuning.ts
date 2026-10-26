/** A B♭ trumpet sounds a whole tone below the note written for it, in semitones. */
export const CONCERT_OFFSET = -2;

const A4_HZ = 440;
const A4_MIDI = 69;

/** The nearest note to a frequency, as a MIDI number, and how far off it is in cents. */
export function nearestNote(hz: number): { midi: number; cents: number } | null {
  if (!(hz > 0)) return null;
  const semitones = 12 * Math.log2(hz / A4_HZ);
  const nearest = Math.round(semitones);
  return { midi: A4_MIDI + nearest, cents: Math.round((semitones - nearest) * 100) };
}
