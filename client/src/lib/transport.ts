import { barAt, type Timeline } from "./timeline";

export type PlaybackStatus = "ready" | "countIn" | "playing" | "paused" | "finished";

/** Where the player stands. Positions are in quarter notes from the top of the exercise. */
export type Transport = {
  status: PlaybackStatus;
  /** Where the music is. While counting in it runs up to `from`. */
  position: number;
  /** Where the music starts (or picks up) when it next plays. */
  from: number;
};

/** At the top, before the count-in, not playing. */
export const AT_TOP: Transport = { status: "ready", position: 0, from: 0 };

/** Play: a bar's count-in before `from`, or straight from it. */
export function startPlaying(t: Transport, timeline: Timeline, countIn: boolean): Transport {
  return countIn
    ? { ...t, status: "countIn", position: t.from - timeline.bar }
    : { ...t, status: "playing", position: t.from };
}

/** Each frame while it plays: the music heard at `now`, finished once it reaches the end. */
export function followMusic(t: Transport, timeline: Timeline, now: number): Transport {
  if (now >= timeline.end) return { ...t, status: "finished", position: timeline.end };
  return { ...t, status: now < t.from ? "countIn" : "playing", position: now };
}

/**
 * Pause at `now`: Resume picks up at the start of its bar. The cursor stays where it
 * stopped, unless `toBar`: then it goes back to that bar's start too (a scored take, which
 * records the bar afresh from there).
 * Paused in the count-in nothing has played, so it waits where it would have started.
 */
export function pauseAt(
  t: Transport,
  timeline: Timeline,
  now: number,
  { toBar = false }: { toBar?: boolean } = {},
): Transport {
  if (now < t.from) return { ...t, status: "paused", position: t.from };
  const barStart = barAt(timeline, now) * timeline.bar;
  return { status: "paused", position: toBar ? barStart : now, from: barStart };
}

/**
 * Move to `to`: while playing the music carries straight on from there, while counting
 * in it counts in again for the new place, and otherwise Play starts there.
 */
export function seekTo(t: Transport, timeline: Timeline, to: number): Transport {
  if (t.status === "playing") return { ...t, position: to, from: to };
  if (t.status === "countIn") return { ...t, position: to - timeline.bar, from: to };
  return { status: "ready", position: to, from: to };
}

/**
 * The bar the previous and next bar buttons step from: the one heard while the music
 * plays (or the last, once it's finished), otherwise the one Play would start in.
 */
export function barNow({ status, position, from }: Transport, timeline: Timeline) {
  return barAt(timeline, status === "playing" || status === "finished" ? position : from);
}
