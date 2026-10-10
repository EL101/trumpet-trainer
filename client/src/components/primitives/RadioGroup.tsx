import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { useId } from "react";
import { radioRecipe } from "@/theme";
import type { ChoiceOption } from "./SegmentedControl";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: radioRecipe });

const Root = withProvider<
  HTMLDivElement,
  HTMLChakraProps<"div"> & { orientation?: "vertical" | "horizontal" }
>("div", "root");
const Item = withContext<HTMLLabelElement, HTMLChakraProps<"label">>("label", "item");
const HiddenInput = withContext<HTMLInputElement, HTMLChakraProps<"input">>("input", "input");
const Dot = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "dot");

type RadioGroupProps<T extends string> = {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  orientation?: "vertical" | "horizontal";
  "aria-label"?: string;
  name?: string;
};

/** `.radio` — a list of single-choice options with dot markers. */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  orientation,
  name,
  ...aria
}: RadioGroupProps<T>) {
  const autoName = useId();
  return (
    <Root role="radiogroup" orientation={orientation} {...aria}>
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
          <Dot aria-hidden />
          {o.label}
        </Item>
      ))}
    </Root>
  );
}
