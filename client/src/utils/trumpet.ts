import { Note } from "tonal";

/**
 * The trumpet the practice player plays exercises on: notes from the FluidR3 GM
 * soundfont (public/samples/trumpet; MIT, see the LICENSE there), a minor third apart at
 * concert pitch, with the notes between repitched from the nearest. Each sample is a
 * steady three-second tone, looped through its middle so a long tone lasts as long as
 * it's written.
 */
const SAMPLE_NOTES = [
  "E3",
  "G3",
  "Bb3",
  "Db4",
  "E4",
  "G4",
  "Bb4",
  "Db5",
  "E5",
  "G5",
  "Bb5",
  "Db6",
  "E6",
] as const;

/** The samples peak near a tenth of full scale; this lifts them to sit beside the click. */
const LEVEL = 3;
const ATTACK = 0.02;
const RELEASE = 0.12;
/** The loop runs from this far in to this far from the end, clear of the encoder's padding. */
const LOOP_FROM = 0.5;
const LOOP_TAIL = 0.4;

type Sample = { midi: number; buffer: AudioBuffer; loopStart: number; loopEnd: number };

export type Trumpet = {
  /** Plays concert-pitch `midi` at `when`, for `duration` seconds, into `output`. */
  play(midi: number, when: number, duration: number, output: AudioNode): void;
};

const loaded = new WeakMap<BaseAudioContext, Promise<Trumpet>>();

/** Fetches and decodes the samples, once per audio context. */
export function loadTrumpet(ctx: BaseAudioContext): Promise<Trumpet> {
  let trumpet = loaded.get(ctx);
  if (!trumpet) {
    trumpet = Promise.all(SAMPLE_NOTES.map((note) => loadSample(ctx, note))).then((samples) =>
      makeTrumpet(ctx, samples),
    );
    // A load that failed (offline, say) is tried again next time.
    trumpet.catch(() => loaded.delete(ctx));
    loaded.set(ctx, trumpet);
  }
  return trumpet;
}

async function loadSample(ctx: BaseAudioContext, note: string): Promise<Sample> {
  const res = await fetch(`/samples/trumpet/${note}.mp3`);
  if (!res.ok) throw new Error(`Couldn't load the trumpet's ${note} (${res.status})`);
  const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
  const wave = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  return {
    midi: Note.midi(note)!,
    buffer,
    loopStart: risingZeroCrossing(wave, LOOP_FROM * rate) / rate,
    loopEnd: risingZeroCrossing(wave, (buffer.duration - LOOP_TAIL) * rate) / rate,
  };
}

/** The first point at or after `from` where the wave crosses zero going up, so loops join smoothly. */
function risingZeroCrossing(wave: Float32Array, from: number) {
  for (let i = Math.floor(from); i < wave.length - 1; i++) {
    if (wave[i] <= 0 && wave[i + 1] > 0) return i + 1;
  }
  return Math.floor(from);
}

function makeTrumpet(ctx: BaseAudioContext, samples: Sample[]): Trumpet {
  const nearest = (midi: number) =>
    samples.reduce((best, s) => (Math.abs(s.midi - midi) < Math.abs(best.midi - midi) ? s : best));

  return {
    play(midi, when, duration, output) {
      const sample = nearest(midi);
      const source = ctx.createBufferSource();
      source.buffer = sample.buffer;
      source.loop = true;
      source.loopStart = sample.loopStart;
      source.loopEnd = sample.loopEnd;
      source.playbackRate.value = 2 ** ((midi - sample.midi) / 12);

      const held = Math.max(duration, ATTACK);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, when);
      envelope.gain.linearRampToValueAtTime(LEVEL, when + ATTACK);
      envelope.gain.setValueAtTime(LEVEL, when + held);
      envelope.gain.linearRampToValueAtTime(0, when + held + RELEASE);

      source.connect(envelope).connect(output);
      source.start(when);
      source.stop(when + held + RELEASE);
      source.onended = () => envelope.disconnect();
    },
  };
}
