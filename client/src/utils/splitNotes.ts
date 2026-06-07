type Durations = "w" | "h" | "q" | "8" | "16" | "32" | "w." | "h." | "q." | "8." | "16.";

export const DURATION_TO_BEATS = {
  w: 4,
  h: 2,
  q: 1,
  "8": 0.5,
  "16": 0.25,
  "32": 0.125,
  "w.": 6,
  "h.": 3,
  "q.": 1.5,
  "8.": 0.75,
  "16.": 0.375,
};

export const BEATS_TO_DURATION = Object.fromEntries(
  Object.entries(DURATION_TO_BEATS).map(([k, v]) => [v, k]),
);

/**Takes in a string of notes following the vexflow format and a time signature following
 * 4/4, 12/8, etc.
 *
 * Returns an array of strings, where each entry in the array represents the notes in
 * one measure. Notes that don't fill up a whole measure are padded at the end with
 * rests.
 */
export function splitNotes(notes: string, timeSig: string): string[] {
  const measures = [];

  const notesLst = notes.split(", ");
  const measureLength = parseInt(timeSig.split("/")[0]);
  const noteValue = parseInt(timeSig.split("/")[1]);
  let currNoteVal = 0;
  let currMeasureDur = 0;
  let currMeasureNotes = "";
  for (const note of notesLst) {
    if (note.includes("/")) {
      if (note.includes("r") && note.includes(".")) {
        currNoteVal = DURATION_TO_BEATS[(note.split("/")[1] + ".") as Durations];
      } else {
        currNoteVal = DURATION_TO_BEATS[note.split("/")[1] as Durations];
      }
    }
    currMeasureDur += currNoteVal / (4 / noteValue);
    currMeasureNotes += currMeasureNotes
      ? `, ${note}`
      : note.includes("/")
        ? note
        : note + `/${BEATS_TO_DURATION[currNoteVal]}`;
    if (currMeasureDur > measureLength) throw new Error("Invalid note sequence");
    else if (currMeasureDur === measureLength) {
      measures.push(currMeasureNotes);
      currMeasureDur = 0;
      currMeasureNotes = "";
    }
  }
  if (currMeasureDur !== 0) {
    let restBeats = (4 / noteValue) * (measureLength - currMeasureDur);

    const beatKeys = Object.entries(BEATS_TO_DURATION).map(([k, _v]) => parseFloat(k));
    while (!beatKeys.includes(restBeats) && restBeats > 0) {
      let noteDurToAdd = 4 / noteValue;
      if (Number.isInteger(restBeats + (DURATION_TO_BEATS["16."] * 4) / noteValue)) {
        noteDurToAdd = (DURATION_TO_BEATS["16."] * 4) / noteValue;
      } else if (Number.isInteger(restBeats + (DURATION_TO_BEATS["32"] * 4) / noteValue)) {
        noteDurToAdd = (DURATION_TO_BEATS["32"] * 4) / noteValue;
      }
      if (BEATS_TO_DURATION[noteDurToAdd].includes(".")) {
        currMeasureNotes += `, B4/${BEATS_TO_DURATION[noteDurToAdd].split(".")[0]}/r.`;
      } else {
        currMeasureNotes += `, B4/${BEATS_TO_DURATION[noteDurToAdd]}/r`;
      }
      restBeats -= (noteDurToAdd * 4) / noteValue;
    }
    const restDur = BEATS_TO_DURATION[restBeats];
    const dotted = restDur.includes(".");
    const strToAdd = dotted ? `, B4/${restDur.split(".")[0]}/r.` : `, B4/${restDur}/r`;
    // console.log(strToAdd)
    measures.push(currMeasureNotes + strToAdd);
  }
  return measures;
}
