import { chakra, type HTMLChakraProps } from "@chakra-ui/react";
import type { CSSProperties } from "react";
import { sliderRecipe } from "@/theme";

const RangeInput = chakra("input", sliderRecipe);

type SliderProps = Omit<
  HTMLChakraProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
> & {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  "aria-label": string;
};

/** A native range input on a hairline track (tempo). */
export function Slider({ value, onChange, min, max, step = 1, style, ...rest }: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <RangeInput
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ...style, "--fill": `${fill}%` } as CSSProperties}
      {...rest}
    />
  );
}
