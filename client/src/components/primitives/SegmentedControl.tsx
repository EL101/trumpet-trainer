import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { useId, type ReactNode } from "react";
import { segmentedRecipe } from "@/theme";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: segmentedRecipe });

const Root = withProvider<HTMLDivElement, HTMLChakraProps<"div"> & { fullWidth?: boolean }>(
  "div",
  "root",
);
const Item = withContext<HTMLLabelElement, HTMLChakraProps<"label">>("label", "item");
const HiddenInput = withContext<HTMLInputElement, HTMLChakraProps<"input">>("input", "input");

export type ChoiceOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  fullWidth?: boolean;
  name?: string;
};

/** `.seg` — one-of-few choice drawn as joined segments (e.g. ±5¢ / ±10¢ / ±15¢). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth,
  name,
  ...aria
}: SegmentedControlProps<T>) {
  const autoName = useId();
  return (
    <Root role="radiogroup" fullWidth={fullWidth} {...aria}>
      {options.map((o) => (
        <Item key={o.value}>
          <HiddenInput
            type="radio"
            name={name ?? autoName}
            value={o.value}
            checked={o.value === value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </Item>
      ))}
    </Root>
  );
}
