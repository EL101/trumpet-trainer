import {
  generateMusic,
  type Difficulty,
  type Range,
  type Key,
  PRACTICAL_MAJOR,
  PRACTICAL_MINOR,
} from "@/utils/generateMusic";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import DashboardTemplate from "../components/DashBoardTemplate";
import { SheetMusic } from "../components/SheetMusic";
import { Button, createListCollection, Flex, Heading } from "@chakra-ui/react";
import Dropdown from "../components/Dropdown";
import HistoryCard from "../components/HistoryCard";
import SaveButton from "@/components/SaveButton";
import ClearHistory from "@/components/ClearHistory";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { clearHistory, getInitialHistory, insertToHistory } from "@/utils/history";

export type MusicInfo = {
  notes: string;
  timeSig: string;
  musicKey: Key;
  range: Range;
  difficulty: Difficulty;
  generationNum: number;
  id: string;
};

export function Generate() {
  const [timeSig, setTimeSig] = useState("4/4");
  const [measures, setMeasures] = useState(2);
  const [key, setKey] = useState<Key>("C major" as Key);
  const [range, setRange] = useState<Range>("LOW");
  const [difficulty, setDifficulty] = useState<Difficulty>("LOW");

  const [history, setHistory] = useState<Record<number, MusicInfo>>({});

  const [generated, setGenerated] = useState<MusicInfo>({
    notes: "",
    timeSig: "4/4",
    musicKey: "C major" as Key,
    generationNum: 0,
    range: "MED",
    difficulty: "LOW",
    id: crypto.randomUUID(),
  });
  const [genCount, setGenCount] = useState(0);

  const { user } = useContext(AuthUserContext);
  useEffect(() => {
    getInitialHistory(user, setHistory, setGenCount);
  }, [user]);

  const addToHistory = useCallback(
    (exercise: MusicInfo) => {
      insertToHistory(exercise, user, setHistory);
    },
    [user],
  );

  const generatedRef = useRef(generated);
  const addToHistoryRef = useRef(addToHistory);

  useEffect(() => {
    generatedRef.current = generated;
  }, [generated]);
  useEffect(() => {
    addToHistoryRef.current = addToHistory;
  }, [addToHistory]);

  useEffect(() => {
    return () => {
      if (generatedRef.current.notes) {
        addToHistoryRef.current(generatedRef.current);
      }
    };
  }, []);

  const handleGenerateClick = () => {
    const newGenCount = genCount + 1;

    const exercise = {
      notes: generateMusic(measures, timeSig, key, range, difficulty),
      timeSig,
      musicKey: key,
      generationNum: newGenCount,
      range,
      difficulty,
      id: crypto.randomUUID(),
    };

    if (generated.notes && !history[generated.generationNum]) {
      addToHistory(generated);
    }

    setGenerated(exercise);
    setGenCount(newGenCount);
  };

  const handleClearClick = () => {
    clearHistory(user, setHistory);
    setGenCount(1);
    setGenerated({ ...generated, generationNum: 1 });
  };

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
          <SaveButton disabled={!generated.notes} generated={generated} />
        </Flex>
      </Flex>
      <Flex minW="0" flex="1" direction="column">
        <Heading size="xl">{generated.notes ? `GEN #${generated.generationNum}` : ""}</Heading>
        <SheetMusic
          notes={generated.notes}
          timeSig={generated.timeSig}
          musicKey={generated.musicKey}
          minW="0"
          height="150px"
          overflowX="auto"
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .map(([_, exercise]) => (
              <HistoryCard
                key={exercise.generationNum}
                musicInfo={exercise}
                generated={generated}
                setGenerated={setGenerated}
                history={history}
                setHistory={setHistory}
              />
            ))}
        </Flex>
      </Flex>
    </DashboardTemplate>
  );
}
