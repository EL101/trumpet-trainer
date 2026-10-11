import { Flex, Text } from "@chakra-ui/react";
import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./Button";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Renders the value, e.g. `(v) => \`A = ${v} Hz\``. */
  format?: (value: number) => ReactNode;
  /** Turns off both buttons and dims the value, for a setting that doesn't apply. */
  disabled?: boolean;
  "aria-label": string;
};

/** − value + in a hairline box (measures, reference pitch, tempo). */
export function Stepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  format = String,
  disabled = false,
  "aria-label": label,
}: StepperProps) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <Flex
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      align="center"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      width="max-content"
    >
      <IconButton
        aria-label={`Decrease ${label}`}
        size="sm"
        borderWidth={0}
        boxSize="34px"
        disabled={disabled || value <= min}
        onClick={() => set(value - step)}
      >
        <Minus />
      </IconButton>
      <Text
        as="output"
        aria-live="polite"
        minWidth="44px"
        px="sm"
        textAlign="center"
        fontVariantNumeric="tabular-nums"
        lineHeight="34px"
        borderInlineWidth="1px"
        borderColor="border"
        opacity={disabled ? 0.45 : undefined}
      >
        {format(value)}
      </Text>
      <IconButton
        aria-label={`Increase ${label}`}
        size="sm"
        borderWidth={0}
        boxSize="34px"
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
      >
        <Plus />
      </IconButton>
    </Flex>
  );
}
