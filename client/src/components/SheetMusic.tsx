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

      const allNotes = score.notes(measureNotes);
      const beamGroups: (typeof allNotes)[] = [];
      let currentGroup: typeof allNotes = [];
      let currentStemDir: number = allNotes[0].stem_direction;
      allNotes.forEach((note) => {
        const dur = note.getDuration();
        const beamable = (dur === "8" || dur === "16") && !note.isRest();
        if (beamable && (note.stem_direction === currentStemDir || currentStemDir === 0)) {
          currentGroup.push(note);
          currentStemDir = note.stem_direction;
        } else {
          if (currentGroup.length >= 2) {
            beamGroups.push([...currentGroup]);
          }
          currentGroup = beamable ? [note] : [];
          currentStemDir = beamable ? note.stem_direction : 0;
        }
      });
      if (currentGroup.length >= 2) {
        beamGroups.push(currentGroup);
      }

      beamGroups.forEach((group) => score.beam(group));

      const stave = system.addStave({
        voices: [score.voice(allNotes, { time: timeSig })],
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
