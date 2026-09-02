import { VStack } from "@chakra-ui/react";
import type { ExerciseProps } from "@/schema";
import KeySelect from "./inputs/KeySelect";
import RangeSelect from "./inputs/RangeSelect";
import MeasuresSelect from "./inputs/MeasuresSelect";
import DifficultySelect from "./inputs/DifficultySelect";
import TimeSigSelect from "./inputs/TimeSigSelect";

export default function RandomGenerate({
  setTimeSig,
  setMeasures,
  setRange,
  setDifficulty,
  setKey,
}: ExerciseProps) {
  return (
    <VStack align="stretch">
      <KeySelect setKey={setKey} />
      <MeasuresSelect setMeasures={setMeasures} />
      <RangeSelect setRange={setRange} />
      <DifficultySelect setDifficulty={setDifficulty} />
      <TimeSigSelect setTimeSig={setTimeSig} />
    </VStack>
  );
}
