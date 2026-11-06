import { Box, Flex, VisuallyHidden, type FlexProps } from "@chakra-ui/react";
import { SegmentedControl } from "@/components/primitives";
import type { Pulse } from "@/lib/meter";
import { NoteValue } from "./TempoMark";

/** A bar's beats as a row of circles, the one sounding now lit in the accent. */
export function BeatDots({
  pulse,
  beat,
  ...rest
}: FlexProps & {
  pulse: Pulse;
  /** The beat sounding now, from 0; null while stopped. */
  beat: number | null;
}) {
  return (
    <Flex gap="sm" aria-hidden {...rest}>
      {Array.from({ length: pulse.beats }, (_, i) => (
        <Box
          key={i}
          boxSize="20px"
          borderRadius="full"
          borderWidth={i === beat ? "1.5px" : "1px"}
          borderColor={i === beat ? "accent.solid" : i === 0 ? "border.strong" : "border"}
          bg={i === beat ? "accent.subtle" : undefined}
        />
      ))}
    </Flex>
  );
}

/** Clicks per beat, offered as the note values the pulse divides into (♩, ♪♪, ♬). */
export function SubdivisionControl({
  pulse,
  value,
  onChange,
}: {
  pulse: Pulse;
  value: number;
  onChange: (value: number) => void;
}) {
  const options = pulse.subdivisions.map((s) => ({
    value: String(s.per),
    label: (
      <>
        <span aria-hidden>
          <NoteValue symbol={s.symbol} />
        </span>
        <VisuallyHidden>{s.label}</VisuallyHidden>
      </>
    ),
  }));
  return (
    <SegmentedControl
      options={options}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      aria-label="Clicks per beat"
    />
  );
}
