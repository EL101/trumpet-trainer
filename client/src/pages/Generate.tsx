import { generateMusic } from "@/utils/generateMusic";
import { useCallback, useContext, useEffect, useRef, useState, type ComponentType } from "react";
import { Box, Button, Flex, Heading, HStack, Text } from "@chakra-ui/react";
import DashboardTemplate from "../components/DashBoardTemplate";
import { SheetMusic } from "../components/SheetMusic";
import HistoryCard from "../components/HistoryCard";
import SaveButton from "@/components/SaveButton";
import ClearHistory from "@/components/ClearHistory";
import RandomGenerate from "@/components/RandomGenerate";
import { AuthUserContext } from "@/auth/AuthUserContext";
import { clearHistory, getInitialHistory, insertToHistory } from "@/utils/history";
import type { Difficulty, ExerciseProps, Key, MusicInfo, Range } from "@/schema";

const EXERCISE_TYPES = ["Long Tones", "Scales", "Lip Slurs", "Etudes", "Random"] as const;
type ExerciseType = (typeof EXERCISE_TYPES)[number];

// Only "Random" has a form so far; the rest fall back to it until they're built.
const EXERCISE_FORMS: Partial<Record<ExerciseType, ComponentType<ExerciseProps>>> = {
  Random: RandomGenerate,
};

const EMPTY_EXERCISE: MusicInfo = {
  id: crypto.randomUUID(),
  notes: "",
  timeSig: "4/4",
  musicKey: "C major",
  noteRange: "MED",
  difficulty: "LOW",
  generationNum: 0,
};

export function Generate() {
  const [timeSig, setTimeSig] = useState("4/4");
  const [measures, setMeasures] = useState(2);
  const [key, setKey] = useState<Key>("C major");
  const [range, setRange] = useState<Range>("LOW");
  const [difficulty, setDifficulty] = useState<Difficulty>("LOW");

  const [history, setHistory] = useState<Record<number, MusicInfo>>({});
  const [generated, setGenerated] = useState<MusicInfo>(EMPTY_EXERCISE);
  const [genCount, setGenCount] = useState(0);

  const [exerciseType, setExerciseType] = useState<ExerciseType>("Random");
  const ExerciseForm = EXERCISE_FORMS[exerciseType] ?? RandomGenerate;

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

  // Flush the exercise on screen into history when the page unmounts. Refs keep the
  // unmount effect at [] while still seeing the latest values.
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

    const exercise: MusicInfo = {
      id: crypto.randomUUID(),
      notes: generateMusic(measures, timeSig, key, range, difficulty),
      timeSig,
      musicKey: key,
      noteRange: range,
      difficulty,
      generationNum: newGenCount,
    };

    setGenerated(exercise);
    addToHistory(exercise);
    setGenCount(newGenCount);
  };

  const handleClearClick = () => {
    clearHistory(user, setHistory);
    setGenCount(1);
    setGenerated((prev) => ({ ...prev, generationNum: 1 }));
  };

  return (
    <DashboardTemplate>
      <Flex flex="1" gap={2} height="100%" direction="column">
        <Heading size="2xl">Generate An Exercise</Heading>
        <Box>
          <Text>Exercise Type</Text>
          <HStack>
            {EXERCISE_TYPES.map((type) => (
              <Button
                key={type}
                px={2}
                minH={0}
                height="30px"
                borderRadius="20px"
                bgColor={exerciseType === type ? "black" : "transparent"}
                borderWidth={1}
                borderColor="black"
                color={exerciseType === type ? "white" : "black"}
                onClick={() => setExerciseType(type)}
              >
                {type}
              </Button>
            ))}
          </HStack>
        </Box>
        <ExerciseForm
          setTimeSig={setTimeSig}
          setMeasures={setMeasures}
          setRange={setRange}
          setKey={setKey}
          setDifficulty={setDifficulty}
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
          <ClearHistory onClear={handleClearClick} />
        </Flex>
        <Flex
          minW="0"
          overflowX="auto"
          gap={2}
          py={2}
          css={{
            // Make the scrollbar always visible (default macOS hides it)
            "&::-webkit-scrollbar": { height: "8px" },
            "&::-webkit-scrollbar-track": { background: "var(--chakra-colors-gray-400)" },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--chakra-colors-gray-400)",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": { background: "var(--chakra-colors-gray-500)" },
            // Firefox
            scrollbarWidth: "thin",
            scrollbarColor: "var(--chakra-colors-gray-400) transparent",
          }}
        >
          {Object.entries(history)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([, exercise]) => (
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
