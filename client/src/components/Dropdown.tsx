import { Select, Portal, type ListCollection } from "@chakra-ui/react";

export default function Dropdown({
  collection,
  label,
  defaultVal,
  onValueChange,
  ...props
}: {
  collection: ListCollection<{ label: string; value: string }>;
  label: string;
  defaultVal: string;
  onValueChange: (details: { value: string[] }) => void;
}) {
  return (
    <Select.Root
      {...props}
      onValueChange={onValueChange}
      collection={collection}
      size="sm"
      // width="320px"
      defaultValue={[defaultVal]}
    >
      <Select.HiddenSelect />
      <Select.Label>{label}</Select.Label>
      <Select.Control>
        <Select.Trigger p={2} borderWidth={2} fontWeight={500} cursor="pointer">
          <Select.ValueText placeholder={label} />
        </Select.Trigger>
        <Select.IndicatorGroup p={2}>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content p={2} bgColor="white" color="black" boxShadow="sm">
            {collection.items.map((item) => (
              <Select.Item
                item={item}
                key={item.value}
                p={2}
                _highlighted={{ color: "white", bgColor: "black" }}
                cursor="pointer"
              >
                {item.label}
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
