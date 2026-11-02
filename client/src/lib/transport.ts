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
 * Pause at `now`: the cursor stays put and Resume picks up at the start of its bar.
 * Paused in the count-in nothing has played, so it waits where it would have started.
 */
export function pauseAt(t: Transport, timeline: Timeline, now: number): Transport {
  if (now < t.from) return { ...t, status: "paused", position: t.from };
  return { status: "paused", position: now, from: barAt(timeline, now) * timeline.bar };
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
