import { chakra } from "@chakra-ui/react";
import { HALF_NOTE, type Pulse } from "@/lib/meter";

/**
 * A note value, as text, except the half note: neither the app's fonts nor most system
 * fonts have its character, so it's drawn to match.
 */
export function NoteValue({ symbol }: { symbol: string }) {
  if (symbol !== HALF_NOTE) return <>{symbol}</>;
  return (
    <chakra.svg
      viewBox="0 0 9 20"
      height="1em"
      width="auto"
      display="inline-block"
      verticalAlign="-0.15em"
      role="img"
      aria-label="half note"
    >
      <ellipse
        cx={4}
        cy={16}
        rx={3.4}
        ry={2.4}
        transform="rotate(-25 4 16)"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
      />
      <path d="M7.1 15V1" stroke="currentColor" strokeWidth={1.1} />
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
