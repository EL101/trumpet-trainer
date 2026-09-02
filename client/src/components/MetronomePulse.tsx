import useMetronome from "@/hooks/useMetronome";
import {
  Box,
  HStack,
  VStack,
  type StackProps,
  Text,
  Heading,
  type BoxProps,
} from "@chakra-ui/react";

type MetronomePulseProps = StackProps & {
  beats: number;
  tempo: number;
  subdivision: number;
  isPlaying: boolean;
};

type BeatCircleProps = BoxProps & {
  large?: boolean;
};
function BeatCircle({ large = false, ...props }: BeatCircleProps) {
  return (
    <Box
      borderWidth="2px"
      borderColor="gray.600"
      boxSize={large ? "16px" : "12px"}
      borderRadius="100%"
      {...props}
    ></Box>
  );
}

export default function MetronomePulse({
  beats,
  tempo,
  subdivision,
  isPlaying,
  ...props
}: MetronomePulseProps) {
  const currentTick = useMetronome({ tempo, beats, subdivision, isPlaying });
  return (
    <VStack
      border="2px solid black"
      height="400px"
      minW="400px"
      maxW="800px"
      w="70%"
      align="center"
      pt="60px"
      {...props}
      gap={8}
    >
      <Box position="relative" boxSize="200px">
        <Box
          key={currentTick}
          width="100%"
          position="absolute"
          inset={0}
          borderRadius="100%"
          border="2px solid black"
          bgColor="black"
          animation={
            currentTick >= 0
              ? currentTick % (1 / subdivision) === 0
                ? `ripple ${Math.min(600, ((60 * 1000) / tempo) * subdivision)}ms ease-out forwards`
                : `smallRipple ${Math.min(600, ((60 * 1000) / tempo) * subdivision)}ms ease-out forwards`
              : undefined
          }
          pointerEvents="none"
        />
        <VStack
          key={currentTick}
          border="2px solid black"
          boxSize="200px"
          borderRadius="100%"
          justify="center"
          animation={
            currentTick >= 0
              ? currentTick % (1 / subdivision) === 0
                ? `${currentTick % (beats / subdivision) === 0 ? "pulseAccent" : "pulse"} ${Math.min(600, (60 * 1000) / tempo)}ms ease-out`
                : `smallPulse ${Math.min(600, ((60 * 1000) / tempo) * subdivision)}ms ease-out forwards`
              : undefined
          }
          position="relative"
          bgColor="#FBF8F0"
        >
          <Heading size="4xl">{tempo}</Heading>
          <Text fontWeight={500} fontSize="lg">
            BPM
          </Text>
        </VStack>
      </Box>
      <HStack align="center">
        {Array.from({ length: beats }, (_, i) => (
          <BeatCircle
            key={i}
            large={i === 0}
            bgColor={Math.floor(currentTick * subdivision) === i ? "gray.600" : "transparent"}
            transition="background-color 80ms ease-out"
          />
        ))}
      </HStack>
    </VStack>
  );
}
