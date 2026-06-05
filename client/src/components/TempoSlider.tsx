import { Box, Flex, HStack, Slider, Text, type BoxProps } from "@chakra-ui/react";

interface SliderInputProps extends BoxProps {
  min: number,
  max: number,
  defaultVal: number,
}
export default function TempoSlider({min, max, defaultVal, ...props}: SliderInputProps) {
  return (
    <Box width="400px" {...props}>
      <Slider.Root 
        width="100%"
        min={min}
        max={max}
        defaultValue={[defaultVal]}>
        <Slider.Label />
        <HStack 
          fontSize="lg"
          fontWeight="bold" gap={1}>
          <Slider.ValueText/>
          <Text>BPM</Text>
        </HStack>
        <Slider.Control>
          <Slider.Track bg="gray.500" height="2px" >
            <Slider.Range bg="black"/>
          </Slider.Track>
          <Slider.Thumb index={0} boxSize="20px" borderColor="transparent" _focusVisible={{ outline: "2px solid black", outlineOffset: "2px" }}>
            <Slider.HiddenInput />
          </Slider.Thumb>
          {/* <Slider.MarkerGroup>
            <Slider.Marker value={min} mt="5px" color="gray.700">{min}</Slider.Marker>
            <Slider.Marker value={max} mt="5px" color="gray.700">{max}</Slider.Marker>
          </Slider.MarkerGroup> */}
        </Slider.Control>
      </Slider.Root>
      <Flex justify="space-between" mt="-5px" fontSize="xs" color="gray.600">
        <Text>0</Text>
        <Text>240</Text>
      </Flex>
    </Box>
  )
}