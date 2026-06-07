import { useState } from "react";
import DashboardTemplate from "../components/DashBoardTemplate";
import SignOut from "../components/SignOut";
import Dropdown from "@/components/Dropdown";
import { Box, createListCollection, Flex, Heading, HStack, Slider } from "@chakra-ui/react";
import { DASHBOARD_PADDING } from "@/constants/layout";
import SliderInput from "@/components/TempoSlider";
import TempoSlider from "@/components/TempoSlider";
import MetronomePulse from "@/components/MetronomePulse";
import SegmentInput from "@/components/SegmentInput";

export default function Metronome() {
  const [bpm, setBpm] = useState<number>(70);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeSig, setTimeSig] = useState<string>("4/4");
  const [currentBeat, setCurrentBeat] = useState<number>(1);
  const [subdivision, setSubdivision] = useState<number>(1);

  const timeSigSelect = createListCollection({
    items: [
      { label: "4/4", value: "4/4" },
      { label: "3/4", value: "3/4" },
      { label: "2/4", value: "2/4" },
      { label: "2/2", value: "2/2" },
      { label: "6/8", value: "6/8" },
      { label: "3/8", value: "3/8" },
      { label: "9/8", value: "9/8" },
      { label: "12/8", value: "12/8" },
    ],
  });

  const subdivisionOptions = [
    { value: 0.25, label: "16th" },
    { value: 0.5, label: "8th" },
    { value: 1, label: "q" },
    { value: 2, label: "h" },
    { value: 4, label: "w" },
  ]
  return (
    <DashboardTemplate>
      <Heading size="2xl">Metronome</Heading>
      <MetronomePulse alignSelf="center" timeSig={timeSig} tempo={bpm} subdivision={subdivision}/>
      <TempoSlider
        min={0}
        max={240}
        defaultVal={100}
        tempo={bpm}
        setTempo={setBpm}
        alignSelf="center"
      />
      <HStack align="end">
        <Dropdown
          collection={timeSigSelect}
          label="TIME SIGNATURE"
          defaultVal="4/4"
          onValueChange={(e) => setTimeSig(e.value[0])}
        />
        <SegmentInput
          label="SUBDIVISION"
          items={subdivisionOptions}
          setSubdivision={setSubdivision}
        />
      </HStack>
    </DashboardTemplate>
  );
}
