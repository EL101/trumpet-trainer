import { useState } from "react";
import DashboardTemplate from "../components/DashBoardTemplate";
import { Heading, HStack } from "@chakra-ui/react";
import TempoSlider from "@/components/TempoSlider";
import MetronomePulse from "@/components/MetronomePulse";
import SegmentInput from "@/components/SegmentInput";
import StepperInput from "@/components/StepperInput";

export default function Metronome() {
  const [bpm, setBpm] = useState<number>(70);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [beats, setBeats] = useState<number>(4);
  const [currentBeat, setCurrentBeat] = useState<number>(1);
  const [subdivision, setSubdivision] = useState<number>(1);

  const subdivisionOptions = [
    { value: 1, label: "♩" },
    { value: 0.5, label: "♪♪" },
    { value: 0.25, label: "♬" },
  ];
  return (
    <DashboardTemplate>
      <Heading size="2xl">Metronome</Heading>
      <MetronomePulse alignSelf="center" beats={beats} tempo={bpm} subdivision={subdivision} />
      <TempoSlider
        min={0}
        max={240}
        defaultVal={100}
        tempo={bpm}
        setTempo={setBpm}
        alignSelf="center"
        width="70%"
        maxW="800px"
      />
      <HStack gap="2rem" align="end" maxW="800px" width="70%" alignSelf="center">
        <StepperInput min={1} max={16} initialVal={4} setBeats={setBeats} />
        <SegmentInput items={subdivisionOptions} setSubdivision={setSubdivision} />
      </HStack>
    </DashboardTemplate>
  );
}
