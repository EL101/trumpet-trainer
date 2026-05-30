import { useEffect, useRef } from "react";
import { Factory, Barline, Accidental } from "vexflow";
import { Box, type BoxProps } from "@chakra-ui/react";
import { splitNotes } from "../utils/splitNotes";
import { getKeySig, type Key } from "@/utils/generateMusic";

export type SheetMusicProps = BoxProps & {
  notes: string;
  timeSig: string;
  musicKey: Key;
};

export function SheetMusic({ notes, timeSig, musicKey, ...rest }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const measures = splitNotes(notes, timeSig);
  const width = 300,
    yOffset = 10;
  const height = 124 + 2 * yOffset;
  useEffect(() => {
    const container = containerRef.current;

    const factory = new Factory({
      renderer: {
        elementId: container as unknown as string,
        width: width * measures.length,
        height: height,
      },
    });

    const score = factory.EasyScore();

    const start = 0;
    for (let i = 0; i < measures.length; i++) {
      const measureNotes = measures[i];
      const system = factory.System({ x: width * i + start, y: yOffset, width: width });

      const allNotes = score.notes(measureNotes);
      const beamGroups: (typeof allNotes)[] = [];
      let currentGroup: typeof allNotes = [];

      let currentStemDir: number = allNotes[0].stem_direction ?? 0;
      allNotes.forEach((note) => {
        const dur = note.getDuration();
        const beamable = (dur === "8" || dur === "16") && !note.isRest();
        if (beamable && (note.stem_direction === currentStemDir || currentStemDir === 0)) {
          currentGroup.push(note);
          currentStemDir = note.stem_direction ?? currentStemDir;
        } else {
          if (currentGroup.length >= 2) {
            beamGroups.push([...currentGroup]);
          }
          currentGroup = beamable ? [note] : [];
          currentStemDir = beamable ? (note.stem_direction ?? currentStemDir) : 0;
        }
      });
      if (currentGroup.length >= 2) {
        beamGroups.push(currentGroup);
      }

      beamGroups.forEach((group) => score.beam(group));
      const voice = score.voice(allNotes, { time: timeSig });
      const keySig = getKeySig(musicKey);
      Accidental.applyAccidentals([voice], keySig);

      const stave = system.addStave({
        voices: [voice],
      });
      if (i === 0) {
        stave.addClef("treble").addTimeSignature(timeSig).addKeySignature(keySig);
      }
      if (i === measures.length - 1) {
        stave.setEndBarType(Barline.type.END);
      }
    }

    factory.draw();

    if (!container) return;
    const svg = container.querySelector("svg");
    if (svg && !("width" in rest)) {
      svg.setAttribute("viewBox", `0 0 ${width * measures.length} ${height}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "100%";
      svg.style.maxHeight = "150";
      svg.style.height = "auto";
    } else if (svg && ("width" in rest)) {
      svg.setAttribute("viewBox", `0 0 ${width * measures.length} ${height}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = rest["width"] as string;
      svg.style.maxHeight = "150";
      svg.style.height = "auto";
    }
    return () => {
      if (container) container.innerHTML = "";
    };
  }, [notes, timeSig, measures]);

  return (
    <Box {...rest} ref={containerRef} borderWidth={2} borderRadius="md" px={3} bgColor="gray.100" />
  );
}
