import { formatPitch } from "./format";
import { dipAt, firstFrom, heardPitch, isVoiced, type PitchSample } from "./hearing";
import {
  BRIDGE_SECONDS,
  DROPOUT_SECONDS,
  heldTo,
  judgePlayed,
  toGhost,
  toMark,
  transcribe,
  type PlayedMark,
  type PlayedNote,
} from "./transcribe";
import { spellInKey } from "./notation";
import { soundingNotes, type SoundingNote, type Timeline } from "./timeline";

export type { PitchSample } from "./hearing";

/** One line of feedback under a score. Mirrors the server's ScoreNoteSchema. */
export type ScoreNote = {
  /** The bar it's about, from 1, or the first of a run of bars. None for the whole run. */
  bar?: number;
  /** The last bar of a run ("Bars 2–3"). */
  endBar?: number;
  /** The beat in the bar, from 1. */
  beat?: number;
  text: string;
  /** For a wrong note: its index in the exercise (rests counted), as the staff counts. */
  index?: number;
  /** For a wrong note: written pitch as a MIDI number, on the page and as played. */
  written?: number;
  played?: number;
  /**
   * For a wrong note: how long it was played, in quarter notes, as `toGhost` writes it (a
   * note value, or past a whole note, whole beats).
   */
  playedLength?: number;
};

export type ScorePart = "rightNotes" | "rhythm" | "intonation" | "tone";

/** The four things a run is scored on, in the order the score card lists them. */
export const SCORE_PARTS: readonly { part: ScorePart; label: string; weight: number }[] = [
  { part: "rightNotes", label: "Right notes", weight: 0.4 },
  { part: "rhythm", label: "Rhythm", weight: 0.3 },
  { part: "intonation", label: "Intonation", weight: 0.2 },
  { part: "tone", label: "Steadiness & tone", weight: 0.1 },
];

/** A run's scores, each 0–100, with the feedback under each. */
export type RunScore = {
  overall: number;
  parts: Record<ScorePart, { score: number; notes: ScoreNote[] }>;
};

/** A run just played: its score, and what to mark on the staff. */
export type ScoredRun = RunScore & {
  /** Whether any note was heard at all. A run with none isn't worth keeping. */
  heard: boolean;
  /** Per staff note (rests counted): how far off it was in cents, or null. */
  cents: (number | null)[];
  /** Every note played, judged, as the played staff draws them. */
  played: PlayedMark[];
};

/** The weighted average of four part scores, rounded. */
export function overallScore(scores: Record<ScorePart, number>) {
  return Math.round(SCORE_PARTS.reduce((sum, { part, weight }) => sum + scores[part] * weight, 0));
}

/** Share of a note's middle (or of a beat, if shorter) that has to sound for it to count. */
const MIN_SOUNDING = 0.4;
/** A sound this close to a note, in semitones, is that note (or a scoop into it). */
const NEAR = 0.9;
/** The note's middle, as shares of its length: away from its attack and release. */
const CORE: [number, number] = [0.25, 0.85];

// Rhythm, in beats. Within ON_TIME is right on; by LOST it scores nothing.
const ON_TIME = 0.08;
const LOST = 0.35;
/** Early or late by this much is mentioned; by WELL_OFF, it's "well" early or late. */
const OFF_BEAT = 0.12;
const WELL_OFF = 0.3;
/** Notes this many beats long or more are held, and checked for being let go early. */
const HELD = 2;
/** A held note let go this much before its end is fine (it's tongued apart from the next). */
const RELEASE_SLACK = 0.35;

// Intonation, in cents. Within IN_TUNE is right on; by OUT_OF_TUNE it scores nothing.
const IN_TUNE = 10;
const OUT_OF_TUNE = 50;
/** Off by this much is mentioned; by QUITE_OFF, "quite" sharp or flat. */
const MENTION_CENTS = 20;
const QUITE_OFF = 35;
/** The whole run off in one direction by this much on average: the slide needs moving. */
const RUN_OFF = 12;

// Steadiness, in cents of spread through the note's middle.
const STEADY = 8;
const UNSTEADY = 30;
const WAVERED = 15;
/** How far the attack can sit off the settled pitch, and for how long, before it's a scoop. */
const SCOOP_CENTS = 35;
const SCOOP_SECONDS = 0.06;
/** How long a note has to jump to another before it's cracked. */
const CRACK_SECONDS = 0.12;
/** Shares of a note's sound that has to be unbroken: below the first it scores nothing for it. */
const BROKEN = 0.5;
const UNBROKEN = 0.9;

/** Feedback lines per part before the rest are summed up in one. */
const MAX_NOTES = 5;

/** How the run was counted. */
export type Timing = {
  /** A beat's length in quarter notes (`Pulse.quarters`). */
  beat: number;
  /** A quarter note's length in seconds, at the tempo played. */
  secondsPerQuarter: number;
};

/** What one written note sounded like. */
type Heard = {
  note: SoundingNote;
  bar: number;
  beat: number;
  /** Nothing sounded through its middle. */
  missed: boolean;
  /** The semitone mostly heard, as a written MIDI number. */
  played: number;
  right: boolean;
  /** How far off the written pitch, if it was the right note. */
  cents: number | null;
  /** How far the note came in from its beat, in beats (early is negative); null if unclear. */
  onset: number | null;
  /** How far before its end a held note was let go, in beats; null if not held or unclear. */
  shortBy: number | null;
  /**
   * A repeated note (the same pitch straight after the note before, not slurred into it)
   * that was never started: no attack, the sound carrying on through its start.
   */
  heldOver: boolean;
  /** Spread of the pitch through the note's middle, in cents. */
  spread: number;
  /** The attack came from below (-1) or above (1) the note; 0 if it didn't scoop. */
  scoop: -1 | 0 | 1;
  /** Share of the note's middle that sounded, from its first sound to its last. */
  sounding: number;
  /** It jumped to another note partway through. */
  cracked: boolean;
};

/**
 * Scores a run from what the microphone heard. `samples` must be in order of `at`.
 * `keySig` (a major key, as VexFlow names it: "F", "Bb") spells the wrong notes played.
 */
export function scoreRun(
  timeline: Timeline,
  samples: readonly PitchSample[],
  { keySig = "C", ...time }: Timing & { keySig?: string },
): ScoredRun {
  const heard = soundingNotes(timeline).map((note, k, all) =>
    hear(note, samples, timeline, time, all[k - 1]),
  );
  const cents: (number | null)[] = timeline.notes.map(() => null);
  for (const h of heard) for (const i of h.note.indices) cents[i] = h.cents;
  const transcribed = transcribe(samples, timeline, time.secondsPerQuarter);

  const played = heard.filter((h) => !h.missed);
  const right = played.filter((h) => h.right);
  // The notes whose start can be judged: one that came in, or a repeat held over.
  const timed = played.filter((h) => h.onset !== null || h.heldOver);
  const name = (midi: number) => formatPitch(spellInKey(midi, keySig).name);

  const scores: Record<ScorePart, number> = {
    rightNotes: percent(heard.map((h) => (h.right ? 1 : 0))),
    rhythm: percent(timed.map(rhythmScore)),
    intonation: percent(right.map((h) => ramp(Math.abs(h.cents!), IN_TUNE, OUT_OF_TUNE))),
    tone: percent(played.map(toneScore)),
  };
  return {
    heard: played.length > 0,
    overall: overallScore(scores),
    parts: {
      rightNotes: { score: scores.rightNotes, notes: rightNoteNotes(heard, transcribed, name) },
      rhythm: { score: scores.rhythm, notes: rhythmNotes(timed) },
      intonation: { score: scores.intonation, notes: intonationNotes(right, played.length > 0) },
      tone: { score: scores.tone, notes: toneNotes(played) },
    },
    cents,
    played: transcribed.map((p, i) =>
      toMark(judgePlayed(p, timeline, heldTo(transcribed, i, time.secondsPerQuarter)), cents),
    ),
  };
}

/**
 * Where what's heard for a written note ends (`hear` reads nothing later): half a beat
 * past the note, where a held note's release is looked for. Once frames from there on
 * are in, the note's results can't change.
 */
export function heardUntil(note: SoundingNote, beat: number) {
  return note.start + note.length + beat / 2;
}

/**
 * How far off the written pitch one note was, in cents, as `scoreRun` gives it per note:
 * null if it wasn't heard, or wasn't the right note. Reads only the samples around it.
 */
export function noteCents(
  note: SoundingNote,
  samples: readonly PitchSample[],
  timeline: Timeline,
  time: Timing,
) {
  return hear(note, samples, timeline, time).cents;
}

/** How one note sounded, from the samples around it (`before`: the note played before it). */
function hear(
  note: SoundingNote,
  samples: readonly PitchSample[],
  timeline: Timeline,
  time: Timing,
  before?: SoundingNote,
): Heard {
  const { beat } = time;
  const end = note.start + note.length;
  const bar = Math.min(timeline.bars - 1, Math.floor(note.start / timeline.bar + 1e-9));
  const where = {
    note,
    bar: bar + 1,
    beat: Math.floor((note.start - bar * timeline.bar) / beat + 1e-9) + 1,
  };
  // The note's middle: past its attack (a quarter of it, or of a beat for a long note),
  // short of its release.
  const coreFrom = note.start + Math.min(note.length * CORE[0], beat * CORE[0]);
  const coreTo = note.start + note.length * CORE[1];
  const core = between(samples, coreFrom, coreTo);
  // What each frame heard, as a written pitch, for this note; null for nothing.
  const pitchOf = (s: PitchSample) => (isVoiced(s) ? heardPitch(s.hz, note.midi) : null);
  const voiced = core.filter((s) => pitchOf(s) !== null);
  // Long enough to count as played: a share of the middle, or of a beat for a long note,
  // so a held note let go early is short, not missed.
  const voicedLength = core.length ? (voiced.length / core.length) * (coreTo - coreFrom) : 0;
  if (!voiced.length || voicedLength < MIN_SOUNDING * Math.min(coreTo - coreFrom, beat)) {
    return {
      ...where,
      missed: true,
      played: note.midi,
      right: false,
      cents: null,
      onset: null,
      shortBy: null,
      heldOver: false,
      spread: 0,
      scoop: 0,
      sounding: 0,
      cracked: false,
    };
  }

  const pitches = voiced.map((s) => pitchOf(s)!);
  const semitones = pitches.map(Math.round);
  const right = semitones.filter((n) => n === note.midi).length / semitones.length >= 0.5;
  // Not right means under half on the written note, so some frame is elsewhere: what was
  // played is the most common of those, never the written note itself.
  const played = right ? note.midi : mode(semitones.filter((n) => n !== note.midi));
  const onPlayed = pitches.filter((p) => Math.round(p) === played);
  const settled = median(onPlayed);
  const spread = standardDeviation(onPlayed.map((p) => (p - settled) * 100));
  // Another note for a moment, through a note that was mostly right. (Long enough not
  // to be the metronome's click, which a microphone near the speakers picks up.)
  const cracked =
    right &&
    longestRun(voiced, (s) => Math.round(pitchOf(s)!) !== note.midi) * time.secondsPerQuarter >=
      CRACK_SECONDS;
  // Gaps in the sound between its first and last frames in the middle.
  const first = core.indexOf(voiced[0]);
  const last = core.lastIndexOf(voiced[voiced.length - 1]);
  const sounding = voiced.length / (last - first + 1);

  // Where it came in: the moment a sound near the note played starts (a scoop into it
  // counts), or a tongue stop too short for a silent frame dips through it (`dipAt`),
  // nearest its beat.
  const near = (i: number) => Math.abs((pitchOf(samples[i]) ?? -Infinity) - played) < NEAR;
  const lead = Math.min(beat / 2, note.length);
  const window = indicesBetween(
    samples,
    note.start - lead,
    note.start + Math.min(note.length / 2, beat / 2),
  );
  let onset: number | null = null;
  for (let i = window.from; i < window.to; i++) {
    const attack = !(i > 0 && near(i - 1)) || dipAt(samples, i, time.secondsPerQuarter);
    if (!near(i) || !attack) continue;
    if (
      onset === null ||
      Math.abs(samples[i].at - note.start) < Math.abs(samples[onset].at - note.start)
    ) {
      onset = i;
    }
  }
  const onsetAt = onset === null ? null : samples[onset].at;

  // A repeated note needs an attack of its own. With none in reach, and the sound
  // running straight through its start from the note before (the same pitch, right up
  // against it, not slurred into it), it was held over rather than played again.
  const repeat =
    before !== undefined &&
    before.midi === note.midi &&
    !before.legato &&
    Math.abs(before.start + before.length - note.start) < 1e-9;
  const atStart = firstFrom(samples, note.start);
  const heldOver =
    onset === null &&
    repeat &&
    atStart > 0 &&
    atStart < samples.length &&
    near(atStart - 1) &&
    near(atStart);

  // Where a held note was let go: the end of its sound after the onset. A dropout of up
  // to BRIDGE_SECONDS that the note picks up from again before its end is the microphone
  // losing it, not a release. Past its end, only a sound that never stopped (over a
  // frame or two missed) carries it on: one that starts again there is the next note, a
  // tongued repeat, and the note was let go before it.
  let shortBy: number | null = null;
  if (onset !== null && note.length >= HELD * beat) {
    const bridge = BRIDGE_SECONDS / time.secondsPerQuarter;
    const dropout = DROPOUT_SECONDS / time.secondsPerQuarter;
    let lastAt = samples[onset].at;
    const until = heardUntil(note, beat);
    for (let i = onset + 1; i < samples.length && samples[i].at < until; i++) {
      if (!near(i)) continue;
      if (samples[i].at - lastAt > (samples[i].at < end ? bridge : dropout)) break;
      lastAt = samples[i].at;
    }
    shortBy = Math.max(0, (end - lastAt) / beat);
  }

  // A scoop: the sound starts well off the pitch it settles on, for long enough to hear.
  let scoop: Heard["scoop"] = 0;
  if (onset !== null) {
    const off = (i: number) => ((pitchOf(samples[i]) ?? settled) - settled) * 100;
    let j = onset;
    while (j < samples.length && pitchOf(samples[j]) !== null && Math.abs(off(j)) > SCOOP_CENTS)
      j++;
    const seconds =
      (samples[Math.max(onset, j - 1)].at - samples[onset].at) * time.secondsPerQuarter;
    if (j > onset && seconds >= SCOOP_SECONDS) scoop = off(onset) < 0 ? -1 : 1;
  }

  return {
    ...where,
    missed: false,
    played,
    right,
    cents: right ? Math.round((settled - note.midi) * 100) : null,
    onset: onsetAt === null ? null : (onsetAt - note.start) / beat,
    shortBy,
    heldOver,
    spread,
    scoop,
    sounding,
    cracked,
  };
}

/** How long a wrong note was held: the note played over it longest, as a note value. */
function playedLength(h: Heard, transcribed: PlayedNote[]): { playedLength?: number } {
  const end = h.note.start + h.note.length;
  let best: PlayedNote | null = null;
  let most = 0;
  for (const p of transcribed) {
    if (p.midi !== h.played) continue;
    const overlap = Math.min(end, p.end) - Math.max(h.note.start, p.start);
    if (overlap > most) [best, most] = [p, overlap];
  }
  return best ? { playedLength: toGhost(best).length } : {};
}

function rhythmScore(h: Heard) {
  // Never started: nothing came in on time.
  if (h.heldOver) return 0;
  const onset = ramp(Math.abs(h.onset!), ON_TIME, LOST);
  if (h.shortBy === null) return onset;
  return 0.75 * onset + 0.25 * ramp(h.shortBy, RELEASE_SLACK, 1);
}

function toneScore(h: Heard) {
  const steady = ramp(h.spread, STEADY, UNSTEADY);
  const attack = h.scoop ? 0 : 1;
  const sounding = 1 - ramp(h.sounding, BROKEN, UNBROKEN);
  const score = 0.5 * steady + 0.2 * attack + 0.3 * sounding;
  return h.cracked ? Math.min(score, 0.5) : score;
}

function rightNoteNotes(
  heard: Heard[],
  transcribed: PlayedNote[],
  name: (midi: number) => string,
): ScoreNote[] {
  const notes = heard
    .filter((h) => !h.right)
    .map((h): ScoreNote => {
      const at = { bar: h.bar, beat: h.beat, index: h.note.indices[0], written: h.note.midi };
      const written = formatPitch(h.note.name);
      return h.missed
        ? { ...at, text: `No note heard for ${written}.` }
        : {
            ...at,
            played: h.played,
            ...playedLength(h, transcribed),
            text: `Played ${name(h.played)} instead of ${written}, ${h.played > h.note.midi ? "too high" : "too low"}.`,
          };
    });
  return capped(notes, (n) => `And ${n} more ${n === 1 ? "note" : "notes"} after that.`);
}

function rhythmNotes(timed: Heard[]): ScoreNote[] {
  const notes: ScoreNote[] = [];
  // Runs of notes in a row that came in early (-1) or late (1).
  let run: Heard[] = [];
  let way = 0;
  const flush = () => {
    if (!run.length) return;
    const first = run[0];
    const last = run[run.length - 1];
    const well = run.some((h) => Math.abs(h.onset!) > WELL_OFF) ? "well " : "";
    if (run.length === 1) {
      notes.push({
        bar: first.bar,
        beat: first.beat,
        text: way < 0 ? `Came in ${well}early.` : `Came in ${well}late.`,
      });
    } else {
      notes.push({
        bar: first.bar,
        ...(last.bar !== first.bar ? { endBar: last.bar } : { beat: first.beat }),
        text: way < 0 ? `Rushed, coming in ${well}early.` : `Dragged, coming in ${well}late.`,
      });
    }
    run = [];
  };
  for (const h of timed) {
    const w = h.heldOver ? 0 : h.onset! < -OFF_BEAT ? -1 : h.onset! > OFF_BEAT ? 1 : 0;
    if (w !== way) flush();
    way = w;
    if (w) run.push(h);
  }
  flush();

  for (const h of timed) {
    if (!h.heldOver) continue;
    notes.push({
      bar: h.bar,
      beat: h.beat,
      text: "Held the note before into this one: tongue the repeated note.",
    });
  }

  for (const h of timed) {
    if (h.shortBy === null || h.shortBy <= RELEASE_SLACK + 0.15) continue;
    notes.push({
      bar: h.bar,
      beat: h.beat,
      text: `Let go of the ${valueName(h.note.length)} early.`,
    });
  }
  return capped(sortByPlace(notes), (n) => `And ${n} more like this.`);
}

/** `anyPlayed`: whether any note was heard, right or wrong. */
function intonationNotes(right: Heard[], anyPlayed: boolean): ScoreNote[] {
  // Notes were played but none was right: the 0 needs saying why.
  if (!right.length && anyPlayed) return [{ text: "No right notes to judge the tuning of." }];
  const notes: ScoreNote[] = [];
  const mean = right.length ? right.reduce((sum, h) => sum + h.cents!, 0) / right.length : 0;
  const tendency =
    right.length >= 3 && Math.abs(mean) > RUN_OFF
      ? mean > 0
        ? { text: "You ran sharp overall: try pulling the main tuning slide out a little." }
        : { text: "You ran flat overall: try pushing the main tuning slide in a little." }
      : null;
  // Against the run's own tendency, so one slide setting doesn't flag every note.
  const off = (h: Heard) => h.cents! - (tendency ? mean : 0);

  // A pitch off the same way every time is one line; others are a line each.
  const byPitch = new Map<number, Heard[]>();
  for (const h of right) byPitch.set(h.note.midi, [...(byPitch.get(h.note.midi) ?? []), h]);
  for (const [, all] of byPitch) {
    const sharp = all.filter((h) => off(h) > MENTION_CENTS);
    const flat = all.filter((h) => off(h) < -MENTION_CENTS);
    const pitch = formatPitch(all[0].note.name);
    for (const [group, word] of [
      [sharp, "sharp"],
      [flat, "flat"],
    ] as const) {
      if (group.length >= 2 && group.length * 2 > all.length) {
        notes.push({
          bar: group[0].bar,
          beat: group[0].beat,
          text: `${pitch} was ${word} ${group.length === all.length ? "every time" : "most times"}.`,
        });
      } else {
        for (const h of group) {
          const quite = Math.abs(off(h)) > QUITE_OFF ? "quite " : "";
          notes.push({ bar: h.bar, beat: h.beat, text: `${pitch} was ${quite}${word}.` });
        }
      }
    }
  }
  const listed = capped(sortByPlace(notes), (n) => `And ${n} more out-of-tune notes.`);
  return tendency ? [tendency, ...listed] : listed;
}

function toneNotes(played: Heard[]): ScoreNote[] {
  const notes: ScoreNote[] = [];
  for (const h of played) {
    const at = { bar: h.bar, beat: h.beat };
    if (h.cracked) notes.push({ ...at, text: "The note cracked partway through." });
    if (h.scoop < 0) notes.push({ ...at, text: "Scooped up into the note." });
    if (h.scoop > 0) notes.push({ ...at, text: "Came down onto the note from above." });
    if (h.spread > WAVERED) notes.push({ ...at, text: "The note wavered." });
    if (h.sounding < 0.75) notes.push({ ...at, text: "The sound broke up." });
  }
  return capped(notes, (n) => `And ${n} more like this.`);
}

/** The first MAX_NOTES, and a line summing up the rest. */
function capped(notes: ScoreNote[], more: (n: number) => string): ScoreNote[] {
  if (notes.length <= MAX_NOTES) return notes;
  const rest = notes.length - (MAX_NOTES - 1);
  return [...notes.slice(0, MAX_NOTES - 1), { text: more(rest) }];
}

function sortByPlace(notes: ScoreNote[]) {
  return [...notes].sort((a, b) => (a.bar ?? 0) - (b.bar ?? 0) || (a.beat ?? 0) - (b.beat ?? 0));
}

/** "half note" for a length of 2 quarters. */
function valueName(quarters: number) {
  const names: Record<number, string> = {
    4: "whole note",
    3: "dotted half note",
    2: "half note",
    1.5: "dotted quarter note",
    1: "quarter note",
  };
  return names[quarters] ?? "long note";
}

/** 1 up to `full`, falling in a straight line to 0 at `none`. */
function ramp(value: number, full: number, none: number) {
  return Math.min(1, Math.max(0, 1 - (value - full) / (none - full)));
}

/** The mean of 0–1 scores, as a whole percentage; 0 for none. */
function percent(scores: number[]) {
  if (!scores.length) return 0;
  return Math.round((100 * scores.reduce((a, b) => a + b, 0)) / scores.length);
}

function indicesBetween(samples: readonly PitchSample[], from: number, to: number) {
  return { from: firstFrom(samples, from), to: firstFrom(samples, to) };
}

function between(samples: readonly PitchSample[], from: number, to: number) {
  const i = indicesBetween(samples, from, to);
  return samples.slice(i.from, i.to);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

/** The most common value; the lowest of any tied for it. */
function mode(values: number[]) {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  for (const [v, n] of counts) {
    const bestCount = counts.get(best)!;
    if (n > bestCount || (n === bestCount && v < best)) best = v;
  }
  return best;
}

/** How long the longest run of samples in a row that pass `test` lasts, in quarter notes. */
function longestRun(samples: PitchSample[], test: (sample: PitchSample) => boolean) {
  let longest = 0;
  let start: number | null = null;
  for (const s of samples) {
    if (!test(s)) {
      start = null;
      continue;
    }
    start ??= s.at;
    longest = Math.max(longest, s.at - start);
  }
  return longest;
}

/** Where a feedback line is, as the score card leads with it: "Bar 3, beat 2", "Bars 2–3". */
export function notePlace({ bar, endBar, beat }: ScoreNote): string | null {
  if (bar === undefined) return null;
  if (endBar !== undefined && endBar !== bar) return `Bars ${bar}–${endBar}`;
  return beat !== undefined ? `Bar ${bar}, beat ${beat}` : `Bar ${bar}`;
}
