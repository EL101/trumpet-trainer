import { useEffect, useRef } from "react";
import { Factory, Barline } from "vexflow";
import { Box } from "@chakra-ui/react";
import { splitNotes, type SheetMusicProps } from "../utils/splitNotes";

export default function SheetMusic({ notes, timeSig, ...rest }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const measures = splitNotes(notes, timeSig);
  const width = 300;
  useEffect(() => {
    const container = containerRef.current;

    const factory = new Factory({
      renderer: {
        elementId: container as unknown as string,
        width: width * measures.length,
        height: 110,
      },
    });

    const score = factory.EasyScore();

    const start = 0;
    for (let i = 0; i < measures.length; i++) {
      const measureNotes = measures[i];
      const system = factory.System({ x: width * i + start, y: -7, width: width });
      console.log(measureNotes);
      const stave = system.addStave({
        voices: [score.voice(score.notes(measureNotes), { time: timeSig })],
      });
      if (i === 0) {
        stave.addClef("treble").addTimeSignature(timeSig);
      }
      if (i === measures.length - 1) {
        stave.setEndBarType(Barline.type.END);
      }
    }

    factory.draw();

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [notes, timeSig, measures]);

  return <Box {...rest} ref={containerRef} width={width * measures.length} />;
}
