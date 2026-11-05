import { useEffect, useMemo, useState } from "react";
import { beatAt, pulseOf } from "@/lib/meter";
import { endlessTimeline } from "@/lib/timeline";
import { getCtx } from "@/utils/click";
import { Playback } from "@/utils/playback";

/**
 * The metronome on its own: the player's playback with no notes and no end, so it
 * clicks until stopped (or unmounted). `beat` is the beat of the bar sounding now, from
 * 0, or null while stopped; `subdivision` is the clicks per beat it actually gives.
 */
export function useMetronome({
  timeSig,
  tempo,
  subdivision,
}: {
  timeSig: string;
  tempo: number;
  subdivision: number;
}) {
  const pulse = useMemo(() => pulseOf(timeSig), [timeSig]);
  const playback = useMemo(
    () => new Playback(getCtx(), endlessTimeline(timeSig), pulse),
    [timeSig, pulse],
  );
  // Clicks per beat that this time signature doesn't offer fall back to the beat.
  const clicks = pulse.subdivisions.some((s) => s.per === subdivision) ? subdivision : 1;
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

  useEffect(() => {
    playback.update({ tempo, notes: false, click: true, subdivision: clicks });
  }, [playback, tempo, clicks]);

  // A new time signature is a new playback: it picks up from the top of a bar.
  useEffect(() => {
    if (!running) return;
    playback.start(0, { countIn: false });
    let frame = requestAnimationFrame(function follow() {
      const now = playback.position();
      setBeat(now === null ? null : beatAt(pulse, now));
      frame = requestAnimationFrame(follow);
    });
    return () => {
      cancelAnimationFrame(frame);
      playback.stop();
    };
  }, [running, playback, pulse]);

  return {
    pulse,
    subdivision: clicks,
    running,
    beat: running ? beat : null,
    start: () => setRunning(true),
    stop: () => setRunning(false),
  };
}
