import { Button, Circle, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { AppShell } from "@/components/layout";
import TunerPendulum from "@/components/TunerPendulum";
import usePitch from "@/hooks/usePitch";
import { Note } from "tonal";
import { useState } from "react";
import SegmentInput from "@/components/SegmentInput";
import { CONCERT_OFFSET, nearestNote } from "@/lib/tuning";

export default function Tuner() {
  const { pitch, start, stop } = usePitch();
  const [listening, setListening] = useState<boolean>(false);
  const [noteType, setNoteType] = useState<string>("concert");
  // Nothing heard yet (a pitch of 0) has no nearest note.
  const heard = nearestNote(pitch);
  const note = heard
    ? Note.fromMidi(noteType === "concert" ? heard.midi : heard.midi - CONCERT_OFFSET)
    : "";
  const noteOptions = [
    { value: "concert", label: "Concert" },
    { value: "b-flat", label: "B♭ Written" },
  ];

  return (
    <AppShell display="flex" flexDirection="column" gap="lg">
      <Heading size="2xl">Tuner</Heading>
      <VStack bgColor="bg.subtle" borderWidth="2px" p={2}>
        <SegmentInput
          items={noteOptions}
          setValue={setNoteType}
          parse={(s) => s}
          maxWidth="250px"
          alignSelf="end"
          align="center"
        ></SegmentInput>
        <HStack opacity={listening ? "1" : "0"} transition="opacity 0.2s ease">
          <Circle bgColor="green.600" size="8px" animation="livePulse 2500ms ease-out infinite" />
          <Text>Listening for pitch</Text>
        </HStack>
        <TunerPendulum cents={heard?.cents ?? 0} />
        <HStack alignItems="baseline-start">
          <Text fontSize="5xl" fontWeight={600}>
            {note ? note.slice(0, -1) : "-"}
          </Text>
          <Text color="fg.muted" fontSize="lg">
            {note.at(-1)}
          </Text>
        </HStack>
        <Text fontSize="lg">{pitch} Hz</Text>
        {/* <Text>Clarity: {clarity * 100}%</Text> */}
      </VStack>
      <Button
        borderColor="black"
        borderWidth={2}
        bg={listening ? "black" : "none"}
        w="fit-content"
        px={3}
        onClick={
          listening
            ? () => {
                stop();
                setListening(false);
              }
            : () => {
                start();
                setListening(true);
              }
        }
      >
        <Circle bgColor="green.600" size="8px" animation="livePulse 2500ms ease-out infinite" />
        <Text color={listening ? "white" : "black"}>{listening ? "Stop" : "Start"} Listening</Text>
      </Button>
    </AppShell>
  );
}
