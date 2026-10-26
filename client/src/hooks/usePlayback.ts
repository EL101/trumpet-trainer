import { useEffect, useMemo, useState } from "react";
import type { Pulse } from "@/lib/meter";
import { barAt, type Timeline } from "@/lib/timeline";
import { getCtx } from "@/utils/click";
import { Playback, type PlaybackSettings } from "@/utils/playback";
import { loadTrumpet } from "@/utils/trumpet";

export type PlaybackStatus = "ready" | "countIn" | "playing" | "paused" | "finished";

/**
 * Plays an exercise along with its staff. `play` counts in a bar (unless `countIn` is
 * off), then starts from the top or picks up at the start of the bar it was paused in;
 * `pause` stops; `restart` goes back to the top, before the count-in, paused. `seek`
 * moves to a position: while playing the music carries straight on from there, and
 * otherwise Play starts there.
 *
 * `position` is where the music is, in quarter notes from the top. While counting in
 * it runs up to `from`, where the music starts.
 */
export function usePlayback(
  timeline: Timeline,
  pulse: Pulse,
  {
    tempo,
    notes,
    click,
    subdivision,
    countIn,
  }: PlaybackSettings & {
    /** Whether Play counts in a bar first. */
    countIn: boolean;
  },
) {
  const playback = useMemo(() => new Playback(getCtx(), timeline, pulse), [timeline, pulse]);
  const [status, setStatus] = useState<PlaybackStatus>("ready");
  const [position, setPosition] = useState(0);
  const [from, setFrom] = useState(0);
  const [sound, setSound] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    playback.update({ tempo, notes, click, subdivision });
  }, [playback, tempo, notes, click, subdivision]);

  useEffect(() => {
    let current = true;
    loadTrumpet(getCtx()).then(
      (trumpet) => {
        if (!current) return;
        playback.setTrumpet(trumpet);
        setSound("ready");
      },
      (error) => {
        console.error("trumpet samples:", error);
        if (current) setSound("failed");
      },
    );
    return () => {
      current = false;
    };
  }, [playback]);

  useEffect(() => () => playback.stop(), [playback]);

  // Follow the music frame by frame while it plays.
  const running = status === "countIn" || status === "playing";
  useEffect(() => {
    if (!running) return;
    let frame = requestAnimationFrame(function follow() {
      const now = playback.position();
      if (now === null) return;
      if (now >= timeline.end) {
        playback.stop();
        setPosition(timeline.end);
        setStatus("finished");
        return;
      }
      setPosition(now);
      setStatus(now < from ? "countIn" : "playing");
      frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, playback, timeline, from]);

  const play = () => {
    playback.start(from, { countIn });
    setPosition(countIn ? from - timeline.bar : from);
    setStatus(countIn ? "countIn" : "playing");
  };

  const pause = () => {
    const now = playback.position() ?? position;
    playback.stop();
    setStatus("paused");
    if (now >= from) {
      setPosition(now);
      setFrom(barAt(timeline, now) * timeline.bar);
    } else {
      // Paused during the count-in: nothing has played, so stay where it would have started.
      setPosition(from);
    }
  };

  const seek = (to: number) => {
    if (status === "playing") {
      playback.start(to, { countIn: false });
      setPosition(to);
    } else if (status === "countIn") {
      // Count in again, for the new place.
      playback.start(to);
      setPosition(to - timeline.bar);
    } else {
      setStatus("ready");
      setPosition(to);
    }
    setFrom(to);
  };

  const restart = () => {
    playback.stop();
    setStatus("ready");
    setPosition(0);
    setFrom(0);
  };

  return { status, position, from, sound, play, pause, seek, restart };
}
