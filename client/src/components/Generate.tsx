import { generateMusic, PITCH_CLASSES, type Difficulty, type Range, type Key, PRACTICAL_MAJOR, PRACTICAL_MINOR } from "@/utils/generateMusic";
import { useState} from "react";
import DashboardTemplate from "./DashBoardTemplate";
import {SheetMusic} from "./SheetMusic";
import { Box, Button, createListCollection, Flex, Heading } from "@chakra-ui/react";
import { DASHBOARD_PADDING } from "./constants/layout";
import Dropdown from "./Dropdown";

export default function Generate() {
  const [timeSig, setTimeSig] = useState("4/4");
  const [measures, setMeasures] = useState(2);
  const [key, setKey] = useState<Key>("C major" as Key);
  const [range, setRange] = useState<Range>("LOW");
  const [difficulty, setDifficulty] = useState<Difficulty>("LOW");
  
  const [generated, setGenerated] = useState<{
    notes: string;
    timeSig: string;
    musicKey: Key;
  } | null>({
    notes: "",
    timeSig: "4/4",
    musicKey: "C major" as Key
  });
  
  const handleGenerateClick = () => {
    setGenerated({
      notes: generateMusic(measures, timeSig, key, range, difficulty),
      timeSig: timeSig,
      musicKey: key
    });
  };

  const keySelect = createListCollection({
    items: [
      ...PRACTICAL_MAJOR.map(k => ({ label: `${k} major`, value: `${k} major` })),
      ...PRACTICAL_MINOR.map(k => ({ label: `${k} minor`, value: `${k} minor` })),
    ]
  });

  const lengthSelect = createListCollection({items: [
    {label: "1 measure", value: "1"},
    {label: "2 measures", value: "2"},
    {label: "3 measures", value: "3"},
    {label: "4 measures", value: "4"},
  ]});

  const rangeSelect = createListCollection({items: [
    {label: "Low (F#3 - C5)", value: "LOW"},
    {label: "Med (C4 - C6)", value: "MED"},
    {label: "High (C5 - G6)", value: "HIGH"},
    {label: "Any (F#3 - C5)", value: "ANY"},
  ]});

  const difficultySelect = createListCollection({items: [
    {label: "Low", value: "LOW"},
    {label: "Med", value: "MED"},
    {label: "High", value: "HIGH"},
  ]});

  const timeSigSelect = createListCollection({ items: [
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

  return (
    <DashboardTemplate>
      <Box height="100%" width="100%" p={DASHBOARD_PADDING}>
        <Flex height="100%" direction={{ base: "column", lg: "row" }}>
          <Flex flex="1"  gap={4} height="100%" borderRightWidth={{ base: 0, lg: 2 }} direction="column">
            <Heading size="2xl">Generate An Exercise</Heading>
            <Dropdown
              collection={keySelect}
              label="KEY / SCALE"
              defaultVal="C major"
              onValueChange={(e) => setKey(e.value[0] as Key)}
            />
            <Dropdown
              collection={lengthSelect}
              label="LENGTH"
              defaultVal="2"
              onValueChange={(e) => setMeasures(parseInt(e.value[0]))}
            />
            <Dropdown
              collection={rangeSelect}
              label="RANGE"
              defaultVal="MED"
              onValueChange={(e) => setRange(e.value[0] as Range)}
            />
            <Dropdown
              collection={difficultySelect}
              label="DIFFICULTY"
              defaultVal="LOW"
              onValueChange={(e) => setDifficulty(e.value[0] as Difficulty)}
            />
            <Dropdown
              collection={timeSigSelect}
              label="TIME SIGNATURE"
              defaultVal="4/4"
              onValueChange={(e) => setTimeSig(e.value[0])}
            />
            <Button bgColor="black" color="white" fontWeight="600" width="8rem" onClick={handleGenerateClick}>Generate</Button>
          </Flex>
          <SheetMusic notes={generated.notes} timeSig={generated.timeSig} musicKey={generated.musicKey} minW="0" border="1px solid red" flex="1" />
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
