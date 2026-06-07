import { Box, HStack, VStack, type StackProps, Text, Heading } from "@chakra-ui/react";

type MetronomePulseProps = StackProps & {
  beats: number;
  tempo: number;
  subdivision: number;
};

function BeatCircle({ large = false }: { large?: boolean }) {
  return (
    <Box
      borderWidth="2px"
      borderColor="gray.600"
      boxSize={large ? "16px" : "12px"}
      borderRadius="100%"
    ></Box>
  );
}

export default function MetronomePulse({
  beats,
  tempo,
  subdivision,
  ...props
}: MetronomePulseProps) {
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
      <VStack border="2px solid black" boxSize="200px" borderRadius="100%" justify="center">
        <Heading size="4xl">{tempo}</Heading>
        <Text fontWeight={500} fontSize="lg">
          BPM
        </Text>
      </VStack>
      <HStack align="center">
        {Array.from({ length: beats }, (_, i) => (
          <BeatCircle key={i} large={i === 0} />
        ))}
      </HStack>
    </VStack>
  );
}
