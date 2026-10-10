import { Flex, Text, type FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

type StatProps = Omit<FlexProps, "direction"> & {
  value: ReactNode;
  label: ReactNode;
  size?: "sm" | "md" | "lg";
  /** `inline`: number and label share a baseline ("12 day streak"). `stacked`: label below. */
  layout?: "inline" | "stacked";
  /** Token for the figure, e.g. `intonation.good`. */
  valueColor?: string;
};

/** A large tabular figure with a small label — streaks, hours, scores. */
export function Stat({
  value,
  label,
  size = "md",
  layout = "stacked",
  valueColor,
  ...rest
}: StatProps) {
  const inline = layout === "inline";
  return (
    <Flex
      direction={inline ? "row" : "column"}
      align={inline ? "baseline" : "flex-start"}
      gap={inline ? "8px" : "4px"}
      {...rest}
    >
      <Text as="span" textStyle={`figure.${size}`} color={valueColor}>
        {value}
      </Text>
      <Text as="span" fontSize={size === "sm" ? "10px" : "12px"} color="fg.muted">
        {label}
      </Text>
    </Flex>
  );
}
