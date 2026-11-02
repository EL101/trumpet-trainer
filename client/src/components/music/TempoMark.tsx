import { chakra } from "@chakra-ui/react";
import type { Pulse } from "@/lib/meter";
import {
  describeNoteValue,
  HEAD_RX,
  layoutNoteValue,
  STEM_OFFSET,
  DOT_OFFSET,
} from "@/lib/noteValue";

/** Where heads sit, how tall stems stand, and how thick and far apart beams are. */
const HEAD_Y = 16;
const STEM_TOP = 1;
const BEAM = 2.2;
const BEAM_GAP = 3.4;

/**
 * A note value (♩, ♪♪, ♬, ♩.), drawn: the app's fonts have no music characters, and
 * the system fonts that stand in space them unevenly. It's an em tall, like the text.
 */
export function NoteValue({ symbol }: { symbol: string }) {
  const { notes, beamed, width } = layoutNoteValue(symbol);
  const inRun = (i: number) => beamed.some(([a, b]) => i >= a && i <= b);
  return (
    <chakra.svg
      viewBox={`0 0 ${width} 20`}
      height="1em"
      width="auto"
      display="inline-block"
      verticalAlign="-0.15em"
      overflow="visible"
      role="img"
      aria-label={describeNoteValue(symbol)}
    >
      {notes.map((note, i) => {
        const stem = note.x + STEM_OFFSET;
        return (
          <g key={i}>
            <ellipse
              cx={note.x}
              cy={HEAD_Y}
              rx={HEAD_RX}
              ry={2.4}
              transform={`rotate(-25 ${note.x} ${HEAD_Y})`}
              fill={note.open ? "none" : "currentColor"}
              stroke={note.open ? "currentColor" : "none"}
              strokeWidth={1.3}
            />
            <path
              d={`M${stem} ${HEAD_Y - 1}V${STEM_TOP}`}
              stroke="currentColor"
              strokeWidth={1.1}
            />
            {note.dotted && (
              <circle cx={note.x + DOT_OFFSET} cy={HEAD_Y} r={1.2} fill="currentColor" />
            )}
            {!inRun(i) &&
              Array.from({ length: note.beams }, (_, f) => (
                <path
                  key={f}
                  d={`M${stem} ${STEM_TOP + f * BEAM_GAP}c0.4 2.4 4.2 3.2 3.4 7.6`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.1}
                />
              ))}
          </g>
        );
      })}
      {beamed.map(([a, b]) =>
        Array.from({ length: Math.min(notes[a].beams, notes[b].beams) }, (_, f) => (
          <rect
            key={`${a}-${f}`}
            x={notes[a].x + STEM_OFFSET - 0.55}
            y={STEM_TOP + f * BEAM_GAP}
            width={notes[b].x - notes[a].x + 1.1}
            height={BEAM}
            fill="currentColor"
          />
        )),
      )}
    </chakra.svg>
  );
}

/** "♩ = 96", in the note value the time signature counts in. */
export function TempoMark({ pulse, bpm }: { pulse: Pulse; bpm: number }) {
  return (
    <>
      <NoteValue symbol={pulse.symbol} /> = {bpm}
    </>
  );
}
