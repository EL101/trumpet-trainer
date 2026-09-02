import { createListCollection } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import Dropdown from "../Dropdown";
import type { Difficulty } from "@/schema";

type DifficultySelectProps = {
  setDifficulty: Dispatch<SetStateAction<Difficulty>>;
};

const difficultySelect = createListCollection({
  items: [
    { label: "Low", value: "LOW" },
    { label: "Med", value: "MED" },
    { label: "High", value: "HIGH" },
  ],
});

export default function DifficultySelect({ setDifficulty }: DifficultySelectProps) {
  return (
    <Dropdown
      collection={difficultySelect}
      label="DIFFICULTY"
      defaultVal="LOW"
      onValueChange={(e) => setDifficulty(e.value[0] as Difficulty)}
    />
  );
}
