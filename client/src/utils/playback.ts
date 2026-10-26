import { barQuarters, type Pulse } from "@/lib/meter";
import { soundingNotes, type SoundingNote, type Timeline } from "@/lib/timeline";
import { CONCERT_OFFSET } from "@/lib/tuning";
import { scheduleClick } from "./click";
import type { Trumpet } from "./trumpet";

/** How far ahead notes and clicks are handed to the audio clock, in seconds. */
const LOOKAHEAD = 0.1;
/** Background tabs run timers about once a second, so look further ahead there. */
const HIDDEN_LOOKAHEAD = 1.5;
const TICK_MS = 25;
/** Room between pressing Play and the first click. */
const START_DELAY = 0.05;
/** Notes that aren't slurred sound for this share of their length, so they're tongued apart. */
const GATE = 0.9;
/** Slack for comparing positions summed from fractions of a beat. */
const EPSILON = 1e-6;

export type PlaybackSettings = {
  /** Beats per minute. */
  tempo: number;
  /** Whether the trumpet plays the notes. */
  notes: boolean;
  /** Whether the metronome clicks along. The count-in clicks either way. */
  click: boolean;
  /** Clicks per beat. */
  subdivision: number;
};

/** A run from Play to Pause (or the end). */
type Run = {
  /** Where the run begins: a bar before `from` with a count-in, `from` itself without. */
  start: number;
  /** Where the count-in ends and the music starts or picks up. */
  from: number;
  /** An audio time and the position it maps to. A tempo change moves them to the present. */
  anchorTime: number;
  anchorPosition: number;
  /** The next sounding note to schedule, and where the next click falls. */
  nextNote: number;
  nextClick: number;
  /** Everything the run plays goes through these, so stopping silences it all at once. */
  notes: GainNode;
  clicks: GainNode;
  timer: number;
};

/**
 * Plays an exercise on the audio clock: a bar of count-in clicks, then the notes on the
 * trumpet (at concert pitch: the staff is written for B♭ trumpet), with the metronome
 * if it's on. Positions are in quarter notes from the top of the exercise.
 */
export class Playback {
  private readonly ctx: AudioContext;
  private readonly timeline: Timeline;
  private readonly pulse: Pulse;
  private readonly sounding: SoundingNote[];
  private readonly bar: number;
  private settings: PlaybackSettings = { tempo: 80, notes: true, click: true, subdivision: 1 };
  private trumpet: Trumpet | null = null;
  private run: Run | null = null;

  constructor(ctx: AudioContext, timeline: Timeline, pulse: Pulse) {
    this.ctx = ctx;
    this.timeline = timeline;
    this.pulse = pulse;
    this.sounding = soundingNotes(timeline);
    this.bar = barQuarters(pulse);
  }

  /** Without a trumpet (still loading, or it failed to) only the clicks play. */
  setTrumpet(trumpet: Trumpet) {
    this.trumpet = trumpet;
  }

  update(settings: PlaybackSettings) {
    const run = this.run;
    const now = this.ctx.currentTime;
    if (run) {
      if (settings.tempo !== this.settings.tempo) {
        // Carry on from where the music is now, at the new speed.
        run.anchorPosition = this.positionAt(run, now);
        run.anchorTime = now;
      }
      run.notes.gain.setTargetAtTime(settings.notes ? 1 : 0, now, 0.01);
    }
    this.settings = settings;
  }

  /**
   * Plays on from `from`, after a bar's count-in unless `countIn` is false (jumping
   * somewhere new mid-run, when the music should carry straight on).
   */
  start(from: number, { countIn = true } = {}) {
    this.stop();
    void this.ctx.resume();
    const notes = this.ctx.createGain();
    notes.gain.value = this.settings.notes ? 1 : 0;
    notes.connect(this.ctx.destination);
    const clicks = this.ctx.createGain();
    clicks.connect(this.ctx.destination);
    const nextNote = this.sounding.findIndex((n) => n.start >= from - EPSILON);
    const start = countIn ? from - this.bar : from;
    this.run = {
      start,
      from,
      anchorTime: this.ctx.currentTime + START_DELAY,
      anchorPosition: start,
      nextNote: nextNote === -1 ? this.sounding.length : nextNote,
      nextClick: start,
      notes,
      clicks,
      timer: window.setInterval(() => this.schedule(), TICK_MS),
    };
    this.schedule();
  }

  stop() {
    const run = this.run;
    if (!run) return;
    this.run = null;
    window.clearInterval(run.timer);
    // Fade out what's sounding or already scheduled, then let it go.
    const now = this.ctx.currentTime;
    run.notes.gain.setTargetAtTime(0, now, 0.015);
    run.clicks.gain.setTargetAtTime(0, now, 0.015);
    window.setTimeout(() => {
      run.notes.disconnect();
      run.clicks.disconnect();
    }, 150);
  }

  /** Where the music is as it's heard (allowing for the speakers' latency); null if stopped. */
  position(): number | null {
    const run = this.run;
    if (!run) return null;
    const heard = this.ctx.currentTime - (this.ctx.outputLatency || 0);
    return Math.max(run.start, this.positionAt(run, heard));
  }

  private positionAt(run: Run, time: number) {
    return run.anchorPosition + (time - run.anchorTime) / this.secondsPerQuarter();
  }

  private timeAt(run: Run, position: number) {
    return run.anchorTime + (position - run.anchorPosition) * this.secondsPerQuarter();
  }

  private secondsPerQuarter() {
    return 60 / (this.settings.tempo * this.pulse.quarters);
  }

  /** Hands the audio clock everything due before the lookahead runs out. */
  private schedule() {
    const run = this.run;
    if (!run) return;
    const lookahead = document.hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD;
    const horizon = this.positionAt(run, this.ctx.currentTime + lookahead);
    const beat = this.pulse.quarters;

    while (run.nextClick < horizon && run.nextClick < this.timeline.end - EPSILON) {
      const at = run.nextClick;
      const countingIn = at < run.from - EPSILON;
      // The count-in clicks each beat; after it, each subdivision if the click is on.
      const step = countingIn ? beat : beat / this.settings.subdivision;
      if ((countingIn || this.settings.click) && onGrid(at, step)) {
        scheduleClick(this.timeAt(run, at), onGrid(at, this.bar), this.ctx, run.clicks);
      }
      run.nextClick = nextOnGrid(at, step);
    }

    while (run.nextNote < this.sounding.length && this.sounding[run.nextNote].start < horizon) {
      const note = this.sounding[run.nextNote++];
      if (!this.trumpet) continue;
      const seconds = note.length * (note.legato ? 1 : GATE) * this.secondsPerQuarter();
      this.trumpet.play(
        note.midi + CONCERT_OFFSET,
        this.timeAt(run, note.start),
        seconds,
        run.notes,
      );
    }
  }
}

function onGrid(position: number, step: number) {
  return Math.abs(position / step - Math.round(position / step)) < EPSILON;
}

/** The next point after `position` on a grid of `step`s. */
function nextOnGrid(position: number, step: number) {
  return (Math.floor(position / step + EPSILON) + 1) * step;
}
