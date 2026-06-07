import { HStack, IconButton, NumberInput, VStack, Text } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import { LuMinus, LuPlus } from "react-icons/lu";

type StepperInputProps = {
  min: number;
  max: number;
  initialVal: number;
  setBeats: Dispatch<SetStateAction<number>>;
};

export default function StepperInput({
  min,
  max,
  initialVal,
  setBeats,
  ...props
}: StepperInputProps) {
  return (
    <VStack>
      <Text alignSelf="start" fontWeight={500} fontSize="0.9rem">
        BEATS
      </Text>
      <NumberInput.Root
        {...props}
        height="40px"
        min={min}
        max={max}
        defaultValue={`${initialVal}`}
        spinOnPress={true}
        onValueChange={(details) => setBeats(parseInt(details.value))}
      >
        <HStack gap="2" height="100%">
          <NumberInput.DecrementTrigger asChild height="100%">
            <IconButton variant="outline" size="sm" color="black" borderWidth={2}>
              <LuMinus />
            </IconButton>
          </NumberInput.DecrementTrigger>
          <NumberInput.ValueText textAlign="center" fontSize="lg" minW="3ch" />
          <NumberInput.IncrementTrigger asChild height="100%">
            <IconButton variant="outline" size="sm" color="black" borderWidth={2}>
              <LuPlus />
            </IconButton>
          </NumberInput.IncrementTrigger>
        </HStack>
      </NumberInput.Root>
    </VStack>
  );
}
