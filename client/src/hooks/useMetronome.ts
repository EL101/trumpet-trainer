import { useEffect, useState } from "react";

type useMetronomeProps = {
  tempo: number;
  subdivision: number;
  isPlaying: boolean;
  beats: number;
};

export default function useMetronome({ tempo, beats, subdivision, isPlaying }: useMetronomeProps) {
  const [currBeat, setCurrBeat] = useState<number>(-1);

  useEffect(() => {
    const delay = (60 * 1000) / tempo;
    if (!isPlaying) {
      return;
    }

    const firstId = setTimeout(() => setCurrBeat(0), 0);
    let tick = 0;
    const id = setInterval(() => {
      if (isPlaying) {
        tick += 1;
        setCurrBeat(tick % beats);
      }
    }, delay);
    return () => {
      clearInterval(id);
      clearTimeout(firstId);
    };
  }, [tempo, subdivision, isPlaying, beats]);

  return isPlaying ? currBeat : -1;
}
