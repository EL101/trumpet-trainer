import { Flex, VStack } from "@chakra-ui/react";
import type { ExerciseProps } from "@/schema";
import KeySelect from "./inputs/KeySelect";

// WIP: etude-specific controls still to be added (see utils/exerciseEngine.ts).
export default function EtudesGenerate({ setKey }: ExerciseProps) {
  return (
    <VStack align="stretch">
      <Flex direction={{ base: "column", md: "row" }}>
        <KeySelect setKey={setKey} />
      </Flex>
    </VStack>
  );
}
