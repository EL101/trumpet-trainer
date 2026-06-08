import { Button, Flex, HStack, Slider, Text, VStack, type StackProps } from "@chakra-ui/react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { LuMinus, LuPlus } from "react-icons/lu";

interface SliderInputProps extends StackProps {
  min: number;
  max: number;
  defaultVal: number;
  tempo: number;
  setTempo: Dispatch<SetStateAction<number>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
}

type TempoButtonProps = {
  children: ReactNode;
  tempo: number;
  setTempo: Dispatch<SetStateAction<number>>;
  increment: number;
  min: number;
  max: number;
};
function TempoButton({ children, tempo, setTempo, increment, min, max }: TempoButtonProps) {
  return (
    <Button
      minW={0}
      boxSize={30}
      p={0}
      border="2px solid black"
      _hover={{ bgColor: "gray.500/20" }}
      bgColor="transparent"
      onClick={() => setTempo(Math.min(max, Math.max(min, tempo + increment)))}
    >
      {children}
    </Button>
  );
}
export default function TempoSlider({
  min,
  max,
  defaultVal,
  tempo,
  setTempo,
  setIsPlaying,
  ...props
}: SliderInputProps) {
  return (
    <VStack width="400px" gap={0} {...props}>
      <Text alignSelf="start" fontWeight={500} fontSize="0.9rem">
        TEMPO
      </Text>
      <HStack width="100%">
        <TempoButton tempo={tempo} setTempo={setTempo} increment={-1} max={max} min={min}>
          <LuMinus size={5} />
        </TempoButton>
        <VStack width="100%">
          <Slider.Root
            width="100%"
            min={min}
            max={max}
            defaultValue={[defaultVal]}
            value={[tempo]}
            onValueChange={(details) => {
              setTempo(details.value[0]);
              setIsPlaying(false);
            }}
            cursor="pointer"
          >
            <Slider.Label />
            {/* <HStack 
              fontSize="xl"
              fontWeight="bold" gap={1}>
              <Slider.ValueText/>
              <Text>BPM</Text>
            </HStack> */}
            <Slider.Control>
              <Slider.Track bg="gray.500" height="2px">
                <Slider.Range bg="black" />
              </Slider.Track>
              <Slider.Thumb
                index={0}
                boxSize="20px"
                borderColor="transparent"
                _focusVisible={{ outline: "2px solid black", outlineOffset: "2px" }}
              >
                <Slider.HiddenInput />
              </Slider.Thumb>
              {/* <Slider.MarkerGroup>
                <Slider.Marker value={min} mt="5px" color="gray.700">{min}</Slider.Marker>
                <Slider.Marker value={max} mt="5px" color="gray.700">{max}</Slider.Marker>
              </Slider.MarkerGroup> */}
            </Slider.Control>
          </Slider.Root>
          <Flex width="100%" justify="space-between" mt="-5px" fontSize="xs" color="gray.600">
            <Text>{min}</Text>
            <Text>{max}</Text>
          </Flex>
        </VStack>
        <TempoButton tempo={tempo} setTempo={setTempo} increment={1} max={max} min={min}>
          <LuPlus size={10} />
        </TempoButton>
      </HStack>
    </VStack>
  );
}
