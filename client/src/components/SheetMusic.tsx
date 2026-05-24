import { useEffect, useRef } from "react";
import { Factory, EasyScore, System, Barline } from "vexflow";
import {ReactNode} from "react";
import { Box, Container, type BoxProps } from "@chakra-ui/react";

const DURATION_TO_BEATS = {
  "w": 4,   
  "h": 2,     
  "q": 1,     
  "8": 0.5,   
  "16": 0.25, 
  "32": 0.125,
  "w.": 6,
  "h.": 3,
  "q.": 1.5,
  "8.": 0.75,
  "16.": 0.375,
};

const BEATS_TO_DURATION = Object.fromEntries(
  Object.entries(DURATION_TO_BEATS).map(([k, v]) => [v,k])
);

type SheetMusicProps = BoxProps & {
  notes: string;
  timeSig: string;
};

function splitNotes(notes: string, timeSig: string) {
  const measures = []

  const notesLst = notes.split(", ");
  const measureLength = parseInt(timeSig.split("/")[0]);
  const noteValue = parseInt(timeSig.split("/")[1]);
  let currNoteVal = 0;
  let currMeasureDur = 0;
  let currMeasureNotes = "";
  for (const note of notesLst) {
    if (note.includes("/")) {
      currNoteVal = DURATION_TO_BEATS[note.split("/")[1]]
    }
    currMeasureDur += currNoteVal / (4 / noteValue)
    currMeasureNotes += 
      currMeasureNotes ? `, ${note}` : 
      note.includes("/") ? note :
      note + `/${BEATS_TO_DURATION[currNoteVal]}`;
    if (currMeasureDur > measureLength) throw new Error("Invalid note sequence");
    else if (currMeasureDur === measureLength) {
      measures.push(currMeasureNotes);
      currMeasureDur = 0;
      currMeasureNotes = "";
    }
  }
  if (currMeasureDur !== 0) {
    let restBeats = (4 / noteValue) * (measureLength - currMeasureDur)
    const beatKeys = Object.entries(BEATS_TO_DURATION).map(([k, _v]) => parseFloat(k))
    console.log(restBeats);
    while (!beatKeys.includes(restBeats) && restBeats > 0) {
      let noteDurToAdd = 4 / noteValue;
      if (Number.isInteger(restBeats + DURATION_TO_BEATS["16."] * 4 / noteValue)) {
        noteDurToAdd = DURATION_TO_BEATS["16."] * 4 / noteValue;
        console.log("ADD " + noteDurToAdd);
      } else if (Number.isInteger(restBeats + DURATION_TO_BEATS["32"] * 4 / noteValue)) {
        noteDurToAdd = DURATION_TO_BEATS["32"] * 4 / noteValue;
        console.log("ADD " + noteDurToAdd);
      }
      if (BEATS_TO_DURATION[noteDurToAdd].includes(".")) {
        currMeasureNotes += `, B4/${BEATS_TO_DURATION[noteDurToAdd].split(".")[0]}/r.`
      } else {
        currMeasureNotes += `, B4/${BEATS_TO_DURATION[noteDurToAdd]}/r`
      }
      restBeats-= noteDurToAdd * 4 / noteValue
    }
    const restDur = BEATS_TO_DURATION[restBeats];
    const dotted = restDur.includes(".");
    const strToAdd = dotted ? 
      `, B4/${restDur.split(".")[0]}/r.` : 
      `, B4/${restDur}/r`
    // measures.push(currMeasureNotes + `, B4/${restDur}/r${dotted ? "." : ""}`);
    console.log(strToAdd)
    measures.push(currMeasureNotes + strToAdd);

  }
  return measures;
}

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
