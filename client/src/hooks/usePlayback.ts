import { useEffect, useMemo, useState } from "react";
import type { Pulse } from "@/lib/meter";
import type { Timeline } from "@/lib/timeline";
import {
  AT_TOP,
  followMusic,
  pauseAt,
  seekTo,
  startPlaying,
  type Transport,
} from "@/lib/transport";
import { getCtx } from "@/utils/click";
import { Playback, type PlaybackSettings } from "@/utils/playback";
import { loadTrumpet } from "@/utils/trumpet";

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
  // The moves between states are in lib/transport; this hook makes the sound follow them.
  const [transport, setTransport] = useState<Transport>(AT_TOP);
  const { status, position, from } = transport;
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
      setTransport((t) => followMusic(t, timeline, now));
      if (now >= timeline.end) playback.stop();
      else frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, playback, timeline]);

  const play = () => {
    playback.start(from, { countIn });
    setTransport((t) => startPlaying(t, timeline, countIn));
  };

  const pause = () => {
    const now = playback.position() ?? position;
    playback.stop();
    setTransport((t) => pauseAt(t, timeline, now));
  };

  const seek = (to: number) => {
    if (status === "playing") playback.start(to, { countIn: false });
    // Count in again, for the new place.
    else if (status === "countIn") playback.start(to);
    setTransport((t) => seekTo(t, timeline, to));
  };

  const restart = () => {
    playback.stop();
    setTransport(AT_TOP);
  };

  return { status, position, from, sound, play, pause, seek, restart };
}
