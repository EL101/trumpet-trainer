import { useEffect, useRef } from "react";
import { Factory, Barline } from "vexflow";
import { Box } from "@chakra-ui/react";
import { splitNotes, type SheetMusicProps } from "../utils/splitNotes";



export default function SheetMusic({notes, timeSig, ...rest} : SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    

    const factory = new Factory({
      renderer: {
        elementId: container as unknown as string,
        width: 500,
        height: 200,
      },
    })

    const score = factory.EasyScore()
    
    const measures = splitNotes(notes, timeSig);
    const width = 250;
    for (let i = 0; i < measures.length; i++) {
      const measureNotes = measures[i];
      const system = factory.System({x: width * i, width: width})
      const stave = system.addStave({
        voices: [score.voice(score.notes(measureNotes))],
      });
      if (i === 0) {
        stave
        .addClef("treble")
        .addTimeSignature(timeSig)
      }
      if (i === measures.length - 1) {
        stave.setEndBarType(Barline.type.END);
      }
    }

    factory.draw()

    return () => {
      if (container) container.innerHTML = "";
    }
  }, [notes, timeSig]);

  return <Box {...rest} ref={containerRef} />;
}
