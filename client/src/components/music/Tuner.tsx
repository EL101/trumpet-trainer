import { Flex, Heading, Text, type FlexProps } from "@chakra-ui/react";
import { Mic, MicOff } from "lucide-react";
import { useState } from "react";
import { Note } from "tonal";
import { Button, SegmentedControl, type ChoiceOption } from "@/components/primitives";
import { usePersistedState } from "@/hooks/usePersistedState";
import usePitch from "@/hooks/usePitch";
import { formatPitch } from "@/lib/format";
import { CONCERT_OFFSET, nearestNote } from "@/lib/tuning";
import { PitchReadout } from "./PitchReadout";
import { TunerGauge } from "./TunerGauge";

type Notation = "written" | "concert";

const NOTATION_OPTIONS: ChoiceOption<Notation>[] = [
  { value: "written", label: "Written" },
  { value: "concert", label: "Concert" },
];

/**
 * The tuner: dial, nearest note and a Listen button. It only listens once asked to, and
 * stops when it unmounts.
 */
export function Tuner(props: FlexProps) {
  const { pitch, error, start, stop } = usePitch();
  const [listening, setListening] = useState(false);
  const [notation, setNotation] = usePersistedState<Notation>("tunerNotation", "written");
  const active = listening && !error;
  const heard = active ? nearestNote(pitch) : null;
  // The microphone hears concert pitch; written is a whole tone above it.
  const written = (midi: number) => midi - CONCERT_OFFSET;
  const name = (midi: number) => formatPitch(Note.fromMidi(midi));
  const shown = heard && (notation === "written" ? written(heard.midi) : heard.midi);
  const other =
    heard &&
    (notation === "written"
      ? `Concert ${name(heard.midi)}`
      : `Written ${name(written(heard.midi))}`);

  const toggle = () => {
    if (active) {
      stop();
      setListening(false);
    } else {
      setListening(true);
      void start();
    }
  };

  return (
    <Flex direction="column" gap="md" {...props}>
      <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
        <Heading as="h2" textStyle="heading.md" m={0}>
          Tuner
        </Heading>
        <SegmentedControl
          options={NOTATION_OPTIONS}
          value={notation}
          onChange={setNotation}
          aria-label="Notes shown as"
        />
      </Flex>
      <TunerGauge cents={heard?.cents ?? null} alignSelf="center" />
      <PitchReadout
        note={shown != null ? name(shown) : null}
        cents={heard?.cents ?? null}
        justify="center"
      />
      <Text
        textStyle="caption"
        color="fg.muted"
        textAlign="center"
        fontVariantNumeric="tabular-nums"
      >
        {heard
          ? `${other} · ${pitch} Hz`
          : active
            ? "Listening…"
            : "Uses your microphone only while it's listening."}
      </Text>
      {error && (
        <Text role="alert" textStyle="meta" color="fg.error" textAlign="center">
          The microphone couldn't be opened. Check that this site may use it.
        </Text>
      )}
      <Button size="sm" alignSelf="center" onClick={toggle}>
        {active ? <MicOff /> : <Mic />}
        {active ? "Stop listening" : "Listen"}
      </Button>
    </Flex>
  );
}
