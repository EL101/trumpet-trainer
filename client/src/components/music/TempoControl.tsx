import { Flex, Text } from "@chakra-ui/react";
import { Slider, Stepper } from "@/components/primitives";
import { MAX_TEMPO, MIN_TEMPO, type Pulse } from "@/lib/meter";
import { TempoMark } from "./TempoMark";

/** The tempo as a stepper for fine steps and a slider for big ones. */
export function TempoControl({
  pulse,
  tempo,
  onChange,
}: {
  pulse: Pulse;
  tempo: number;
  onChange: (tempo: number) => void;
}) {
  return (
    // One group for screen readers, so the two controls are "fine" and "slider" within it.
    // A floated legend lays out like any other flex item.
    <Flex as="fieldset" justify="center" align="center" gap="md" wrap="wrap" minWidth={0}>
      <Text as="legend" float="left" p={0} textStyle="meta" color="fg.muted">
        Tempo
      </Text>
      <Stepper
        value={tempo}
        onChange={onChange}
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        format={(v) => <TempoMark pulse={pulse} bpm={v} />}
        aria-label="Tempo, fine"
      />
      <Slider
        value={tempo}
        onChange={onChange}
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        width="160px"
        aria-label="Tempo, slider"
        aria-valuetext={`${tempo} beats per minute`}
      />
    </Flex>
  );
}
