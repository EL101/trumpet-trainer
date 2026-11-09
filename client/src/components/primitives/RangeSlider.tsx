import { createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { rangeSliderRecipe } from "@/theme";
import { trackLength, trackPosition } from "./rangeTrack";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: rangeSliderRecipe });

const Root = withProvider<HTMLDivElement, HTMLChakraProps<"div">>("div", "root");
const Rail = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "rail");
const Band = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "band");
const Reference = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "reference");
const Thumb = withContext<HTMLInputElement, HTMLChakraProps<"input">>("input", "input");
const AxisRoot = withProvider<HTMLDivElement, HTMLChakraProps<"div">>("div", "axis");
const Mark = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "mark");

type Pair = readonly [number, number];

type RangeSliderProps = Omit<HTMLChakraProps<"div">, "onChange" | "defaultValue"> & {
  /** The low and high ends. */
  value: Pair;
  /**
   * Called as either end moves, with both ends: the one moved at the value it was
   * dragged or stepped to, unclamped, so the caller decides how far it may go.
   */
  onChange: (value: Pair, moved: 0 | 1) => void;
  min: number;
  max: number;
  step?: number;
  /** Accessible names for the two thumbs, e.g. ["Low range, lowest note", …]. */
  labels: readonly [string, string];
  /** What a value means, read out for each thumb (a note name rather than a number). */
  valueText?: (value: number) => string;
  /** A span to outline behind the band, such as the default it was moved from. */
  reference?: Pair;
  disabled?: boolean;
};

/**
 * A slider with two thumbs on one rail, for a span (a range's lowest and highest note).
 * Each thumb is a native range input, so both work from the keyboard.
 */
export function RangeSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  labels,
  valueText,
  reference,
  disabled,
  ...rest
}: RangeSliderProps) {
  const [low, high] = value;
  return (
    <Root {...rest}>
      <Rail />
      {reference && (
        <Reference
          left={trackPosition(reference[0], min, max)}
          width={trackLength(reference[0], reference[1], min, max)}
        />
      )}
      <Band left={trackPosition(low, min, max)} width={trackLength(low, high, min, max)} />
      {([0, 1] as const).map((end) => (
        <Thumb
          key={end}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[end]}
          disabled={disabled}
          aria-label={labels[end]}
          aria-valuetext={valueText?.(value[end])}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(end === 0 ? [next, high] : [low, next], end);
          }}
        />
      ))}
    </Root>
  );
}

type RangeAxisProps = HTMLChakraProps<"div"> & {
  min: number;
  max: number;
  /** Labels under the rail, at their values. The two ends hug the edges. */
  marks: readonly { value: number; label: ReactNode }[];
};

/** Labels for a `RangeSlider`'s rail, laid out to line up with its thumbs. */
export function RangeAxis({ min, max, marks, ...rest }: RangeAxisProps) {
  return (
    <AxisRoot aria-hidden="true" {...rest}>
      {marks.map(({ value, label }) => (
        <Mark
          key={value}
          left={trackPosition(value, min, max)}
          transform={
            value <= min
              ? "translateX(calc(var(--range-thumb) / -2))"
              : value >= max
                ? "translateX(calc(-100% + var(--range-thumb) / 2))"
                : undefined
          }
        >
          {label}
        </Mark>
      ))}
    </AxisRoot>
  );
}
