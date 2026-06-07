import { SegmentGroup, VStack } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";

type SegmentInputProps = {
  setSubdivision: Dispatch<SetStateAction<number>>;
  items: { value: number; label: string }[];
};
export default function SegmentInput({ setSubdivision, items }: SegmentInputProps) {
  return (
    <VStack width="100%">
      {/* <Heading size="sm">{label}</Heading> */}
      <SegmentGroup.Root
        width="100%"
        height="40px"
        bg="transparent"
        border="2px solid black"
        onValueChange={(details) => setSubdivision(parseFloat(details.value ?? "1"))}
      >
        <SegmentGroup.Indicator bgColor="black" boxShadow="none" height="100%" borderRadius="0" />
        {items.map((item) => (
          <SegmentGroup.Item
            key={item.value}
            value={`${item.value}`}
            width="100%"
            color="black"
            _checked={{
              color: "white",
            }}
            cursor="pointer"
            px={4}
            py={2}
            transition="color 0.2s ease"
            fontSize="1.5rem"
          >
            <SegmentGroup.ItemText>{item.label}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    </VStack>
  );
}
