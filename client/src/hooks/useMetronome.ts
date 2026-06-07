import { useEffect, useState } from "react";

type useMetronomeProps = {
  tempo: number;
  timeSig: string;
  subdivision: number;
  playing: boolean;
};

export default function useMetronome({ tempo, timeSig, subdivision, playing }: useMetronomeProps) {
  const [currBeat, setCurrBeat] = useState<number>(-1);
  const [measureBeats, noteVal] = timeSig.split("/").map((e: string) => parseInt(e));
  useEffect(() => {
    const delay = ((60 * 1000) / tempo) * ((subdivision * noteVal) / 4);
    const beats = measureBeats / ((subdivision * noteVal) / 4);
    setInterval(() => {
      if (playing) {
        setCurrBeat((currBeat + 1) % beats);
      }
    }, delay);
  }, [tempo, timeSig, subdivision, playing, currBeat, measureBeats, noteVal]);

  return currBeat;
}
