import { Button, Circle, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import DashboardTemplate from "../components/DashBoardTemplate";
import TunerPendulum from "@/components/TunerPendulum";
import usePitch from "@/hooks/usePitch";
import { Note } from "tonal";
import { useState } from "react";
import SegmentInput from "@/components/SegmentInput";

const A4_MIDI = 69;

function getNoteInfo(hz: number) {
  const semitonesFromA4 = 12 * Math.log2(hz / 440);
  const nearestSemitone = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - nearestSemitone) * 100);
  const midiNumber = A4_MIDI + nearestSemitone;
  return { midiNumber, cents };
}

export default function Tuner() {
  const { pitch, start, stop } = usePitch();
  const [listening, setListening] = useState<boolean>(false);
  const [noteType, setNoteType] = useState<string>("concert");
  const note =
    noteType === "concert"
      ? Note.fromMidi(getNoteInfo(pitch).midiNumber)
      : Note.fromMidi(getNoteInfo(pitch).midiNumber + 2);
  const noteOptions = [
    { value: "concert", label: "Concert" },
    { value: "b-flat", label: "B♭ Written" },
  ];

  return (
    <DashboardTemplate>
      <Heading size="2xl">Tuner</Heading>
      <VStack bgColor="#FBF8F0" borderWidth="2px" p={2}>
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
        <TunerPendulum cents={getNoteInfo(pitch).cents} />
        <HStack alignItems="baseline-start">
          <Text fontSize="5xl" fontWeight={600}>
            {note ? note.slice(0, -1) : "-"}
          </Text>
          <Text color="#8A8170" fontSize="lg">
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
    </DashboardTemplate>
  );
}
