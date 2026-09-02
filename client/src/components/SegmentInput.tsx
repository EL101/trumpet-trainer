import { SegmentGroup, VStack, type StackProps } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";

type SegmentInputProps<T> = StackProps & {
  setValue: Dispatch<SetStateAction<T>>;
  parse: (value: string) => T;
  items: { value: T; label: string }[];
};
export default function SegmentInput<T>({
  setValue,
  parse,
  items,
  ...props
}: SegmentInputProps<T>) {
  return (
    <VStack width="100%" {...props}>
      {/* <Heading size="sm">{label}</Heading> */}
      <SegmentGroup.Root
        width="100%"
        height="40px"
        bg="transparent"
        border="2px solid black"
        onValueChange={(details) => setValue(parse(details.value ?? ""))}
        defaultValue={`${items[0].value}`}
      >
        <SegmentGroup.Indicator bgColor="black" boxShadow="none" height="100%" borderRadius="0" />
        {items.map((item) => (
          <SegmentGroup.Item
            key={String(item.value)}
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
            fontSize="1rem"
          >
            <SegmentGroup.ItemText>{item.label}</SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    </VStack>
  );
}
