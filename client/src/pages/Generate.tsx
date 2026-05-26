import {
  generateMusic,
  type Difficulty,
  type Range,
  type Key,
  PRACTICAL_MAJOR,
  PRACTICAL_MINOR,
} from "@/utils/generateMusic";
import { useState } from "react";
import DashboardTemplate from "../components/DashBoardTemplate";
import { SheetMusic } from "../components/SheetMusic";
import { Box, Button, createListCollection, Flex, Heading } from "@chakra-ui/react";
import { DASHBOARD_PADDING } from "../constants/layout";
import Dropdown from "../components/Dropdown";
import HistoryCard from "../components/HistoryCard";
import { usePersistedState } from "@/hooks/usePersistedState";
import SaveButton from "@/components/SaveButton";
import ClearHistory from "@/components/ClearHistory";

export type MusicInfo = {
  notes: string;
  timeSig: string;
  musicKey: Key;
  generationNum: number;
};

export function Generate() {
  const [timeSig, setTimeSig] = useState("4/4");
  const [measures, setMeasures] = useState(2);
  const [key, setKey] = useState<Key>("C major" as Key);
  const [range, setRange] = useState<Range>("LOW");
  const [difficulty, setDifficulty] = useState<Difficulty>("LOW");

  const [history, setHistory] = usePersistedState<Record<number, MusicInfo>>(
    "exercise-history",
    {}
  );

  const [generated, setGenerated] = usePersistedState<MusicInfo>("exercise", {
    notes: "",
    timeSig: "4/4",
    musicKey: "C major" as Key,
    generationNum: 0,
  });

  const [genCount, setGenCount] = usePersistedState("gen-count", 1);

  const handleGenerateClick = () => {
    const newGenCount = genCount + 1;
    

    const exercise = {
      notes: generateMusic(measures, timeSig, key, range, difficulty),
      timeSig,
      musicKey: key,
      generationNum: newGenCount
    };

    if (generated.notes && !history[generated.generationNum]) {
      setHistory({ ...history, [genCount]: generated });
    }

    setGenerated(exercise);
    setGenCount(newGenCount);
  };

  const handleClearClick = () => {
    setHistory({});
    setGenCount(1);
    setGenerated({...generated, generationNum: 1});
  }

  const keySelect = createListCollection({
    items: [
      ...PRACTICAL_MAJOR.map((k) => ({ label: `${k} major`, value: `${k} major` })),
      ...PRACTICAL_MINOR.map((k) => ({ label: `${k} minor`, value: `${k} minor` })),
    ],
  });

  const lengthSelect = createListCollection({
    items: [
      { label: "1 measure", value: "1" },
      { label: "2 measures", value: "2" },
      { label: "3 measures", value: "3" },
      { label: "4 measures", value: "4" },
    ],
  });

  const rangeSelect = createListCollection({
    items: [
      { label: "Low (F#3 - C5)", value: "LOW" },
      { label: "Med (C4 - C6)", value: "MED" },
      { label: "High (C5 - G6)", value: "HIGH" },
      { label: "Any (F#3 - C5)", value: "ANY" },
    ],
  });

  const difficultySelect = createListCollection({
    items: [
      { label: "Low", value: "LOW" },
      { label: "Med", value: "MED" },
      { label: "High", value: "HIGH" },
    ],
  });

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

  return (
    <DashboardTemplate>
      <Box height="100%" minW="0" flex="1" p={DASHBOARD_PADDING}>
        <Flex height="100%" direction="column" gap={5}>
          <Flex
            flex="1"
            gap={2}
            height="100%"
            // borderRightWidth={{ base: 0, lg: 2 }}
            direction="column"
          >
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
            <Flex gap={2}>
              <Button
                bgColor="black"
                color="white"
                fontWeight="600"
                width="8rem"
                _hover={{ opacity: 0.85 }}
                transition="opacity"
                onClick={handleGenerateClick}
              >
                Generate
              </Button>
              <SaveButton disabled={generated.notes ? false : true} />
            </Flex>
          </Flex>
          <Flex minW="0" flex="1" direction="column">
            <Heading size="xl">GEN #{generated.generationNum}</Heading>
            <SheetMusic
              notes={generated.notes}
              timeSig={generated.timeSig}
              musicKey={generated.musicKey}
              minW="0"
            />
            <Flex gap={2} align="center" justify="space-between" mt={2}>
              <Heading size="lg">HISTORY</Heading>
              <ClearHistory onClear={handleClearClick}></ClearHistory>
            </Flex>
            <Flex
              minW="0"
              overflowX="auto"
              gap={2}
              py={2}
              css={{
                // Make the scrollbar always visible (default macOS hides it)
                "&::-webkit-scrollbar": {
                  height: "8px",
                },
                "&::-webkit-scrollbar-track": {
                  // background: "gray",
                  background: "var(--chakra-colors-gray-400)",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "var(--chakra-colors-gray-400)",
                  borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "var(--chakra-colors-gray-500)",
                },
                // Firefox
                scrollbarWidth: "thin",
                scrollbarColor: "var(--chakra-colors-gray-400) transparent",
              }}
            >
              {Object.entries(history)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([_, exercise]) => (
                  <HistoryCard 
                    musicInfo={exercise} 
                    generated={generated}
                    setGenerated={setGenerated}
                    history={history}
                    setHistory={setHistory}
                    />
              ))}
            </Flex>
          </Flex>
        </Flex>
      </Box>
    </DashboardTemplate>
  );
}
