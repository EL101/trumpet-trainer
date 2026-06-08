import { getCtx, scheduleClick } from "@/utils/click";
import { useEffect, useState } from "react";

type useMetronomeProps = {
  tempo: number;
  subdivision: number;
  isPlaying: boolean;
  beats: number;
};

export default function useMetronome({ tempo, beats, subdivision, isPlaying }: useMetronomeProps) {
  const [currTick, setCurrTick] = useState<number>(-1);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let tick = 0;

    const ctx = getCtx();
    let nextBeatTime = ctx.currentTime;
    const tickAhead = 0.1;
    const timeouts: number[] = [];
    const scheduler = () => {
      while (nextBeatTime < ctx.currentTime + tickAhead) {
        const beat = Math.floor(tick * subdivision) % beats;
        const isWholeBeat = tick % (1 / subdivision) === 0;
        scheduleClick(nextBeatTime, beat === 0 && isWholeBeat, ctx);

        const delayMs = (nextBeatTime - ctx.currentTime) * 1000;
        const thisTick = tick;
        const id = setTimeout(() => setCurrTick(thisTick), Math.max(0, delayMs));
        timeouts.push(id);
        nextBeatTime += 60 / (tempo / subdivision);

        tick += 1;
        tick %= beats / subdivision;
      }
    };
    scheduler();
    const id = setInterval(scheduler, 25);

    return () => {
      clearInterval(id);
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [tempo, subdivision, isPlaying, beats]);

  return isPlaying ? currTick : -1;
}
