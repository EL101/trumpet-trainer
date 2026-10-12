import { useEffect, useRef } from "react";
import { Factory, Barline, Accidental, Curve, StaveTie, type StemmableNote } from "vexflow";
import { Box, type BoxProps } from "@chakra-ui/react";
import { splitNotes } from "../utils/splitNotes";
import { getKeySig } from "@/utils/generateMusic";
import type { Key } from "@/schema";

type SheetMusicProps = BoxProps & {
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
    // Every note in order, with its tie and slur marks, for drawing ties and slurs at the end.
    const sequence: { note: StemmableNote; marks: string[] }[] = [];
    for (let i = 0; i < measures.length; i++) {
      // EasyScore can't read the tie and slur marks ("(C4/q~)"), so they're taken off here.
      const tokens = measures[i]
        .split(",")
        .map((token) => /^(\(?)(.*?)(~?\)?)$/.exec(token.trim())!);
      const measureNotes = tokens.map(([, , body]) => body).join(", ");
      const system = factory.System({ x: width * i + start, y: yOffset, width: width });

      const allNotes = score.notes(measureNotes);
      allNotes.forEach((note, k) => {
        const [, open, , close] = tokens[k];
        sequence.push({ note, marks: [...open, ...close] });
      });
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
    let slurStart: StemmableNote | null = null;
    sequence.forEach(({ note, marks }, i) => {
      const next = sequence[i + 1];
      if (marks.includes("~") && next) {
        new StaveTie({
          first_note: note,
          last_note: next.note,
          first_indices: [0],
          last_indices: [0],
        })
          .setContext(factory.getContext())
          .draw();
      }
      if (marks.includes("(")) slurStart = note;
      if (marks.includes(")") && slurStart) {
        new Curve(slurStart, note, {}).setContext(factory.getContext()).draw();
        slurStart = null;
      }
    });

    if (!container) return;
    const svg = container.querySelector("svg");
    if (svg) {
      svg.setAttribute("viewBox", `0 0 ${width * measures.length} ${height}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.flexShrink = "0";
      svg.style.marginLeft = "auto";
      svg.style.marginRight = "auto";
      if ("height" in rest) {
        svg.style.height = rest["height"] as string;
        svg.style.width = (rest["width"] as string) ?? "100%";
      } else {
        svg.style.width = (rest["width"] as string) ?? "100%";
        svg.style.maxHeight = "150px";
        svg.style.height = "auto";
      }
    }
    return () => {
      if (container) container.innerHTML = "";
    };
  }, [notes, timeSig, measures]);

  return (
    <Box
      ref={containerRef}
      display="flex"
      alignItems="center"
      borderWidth={2}
      borderRadius="md"
      px={3}
      bgColor="gray.100"
      {...rest}
    />
  );
}
