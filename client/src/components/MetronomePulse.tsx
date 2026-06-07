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
  const currentBeat = useMetronome({ tempo, beats, subdivision, isPlaying });
  return (
    <VStack
      key={currentBeat}
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
          opacity={currentBeat >= 0 ? "1" : "0"}
          width="100%"
          position="absolute"
          inset={0}
          borderRadius="100%"
          border="2px solid black"
          bgColor="black"
          animation={
            currentBeat >= 0
              ? `ripple ${Math.min(600, (60 * 1000) / tempo)}ms ease-out forwards`
              : undefined
          }
          pointerEvents="none"
        />
        <VStack
          border="2px solid black"
          boxSize="200px"
          borderRadius="100%"
          justify="center"
          animation={
            currentBeat >= 0
              ? `${currentBeat === 0 ? "pulseAccent" : "pulse"} 200ms ease-out`
              : undefined
          }
          position="relative"
          bgColor="var(--bg-color)"
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
            bgColor={currentBeat === i ? "black" : "transparent"}
            transition="background-color 80ms ease-out"
          />
        ))}
      </HStack>
    </VStack>
  );
}
