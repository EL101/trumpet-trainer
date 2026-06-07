import { useState } from "react";
import DashboardTemplate from "../components/DashBoardTemplate";
import { Button, Heading, HStack } from "@chakra-ui/react";
import TempoSlider from "@/components/TempoSlider";
import MetronomePulse from "@/components/MetronomePulse";
import SegmentInput from "@/components/SegmentInput";
import StepperInput from "@/components/StepperInput";
import { LuPlay, LuSquare } from "react-icons/lu";

export default function Metronome() {
  const [bpm, setBpm] = useState<number>(70);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [beats, setBeats] = useState<number>(4);
  const [subdivision, setSubdivision] = useState<number>(1);

  const subdivisionOptions = [
    { value: 1, label: "♩" },
    { value: 0.5, label: "♪♪" },
    { value: 0.25, label: "♬" },
  ];

  const width = "70%";
  const maxW = "800px";
  return (
    <DashboardTemplate>
      <Heading size="2xl">Metronome</Heading>
      <MetronomePulse
        alignSelf="center"
        beats={beats}
        tempo={bpm}
        subdivision={subdivision}
        isPlaying={isPlaying}
      />
      <TempoSlider
        min={1}
        max={240}
        defaultVal={100}
        tempo={bpm}
        setTempo={setBpm}
        alignSelf="center"
        width={width}
        maxW={maxW}
      />
      <HStack gap="2rem" align="end" maxW={maxW} width={width} alignSelf="center">
        <StepperInput min={1} max={16} initialVal={4} setBeats={setBeats} />
        <SegmentInput items={subdivisionOptions} setSubdivision={setSubdivision} />
      </HStack>
      <Button
        width={width}
        maxW={maxW}
        alignSelf="center"
        bgColor="black"
        color="white"
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? (
          <>
            <LuSquare fill="white" />
            Stop
          </>
        ) : (
          <>
            <LuPlay fill="white" />
            Play
          </>
        )}
      </Button>
    </DashboardTemplate>
  );
}
