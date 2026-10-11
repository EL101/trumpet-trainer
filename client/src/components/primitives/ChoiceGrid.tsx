import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { useId } from "react";
import { choiceGridRecipe } from "@/theme";
import type { ChoiceOption } from "./SegmentedControl";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: choiceGridRecipe });

const Root = withProvider<HTMLDivElement, HTMLChakraProps<"div">>("div", "root");
const Item = withContext<HTMLLabelElement, HTMLChakraProps<"label">>("label", "item");
const HiddenInput = withContext<HTMLInputElement, HTMLChakraProps<"input">>("input", "input");

type ChoiceGridProps<T extends string> = {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Options per row. */
  columns?: number;
  "aria-label"?: string;
  name?: string;
};

/** One-of-many choice laid out as a grid of chips (keys, time signatures). */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  name,
  ...aria
}: ChoiceGridProps<T>) {
  const autoName = useId();
  return (
    <Root role="radiogroup" gridTemplateColumns={`repeat(${columns}, minmax(0, 1fr))`} {...aria}>
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
