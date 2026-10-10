import { Box, Flex, Text, type FlexProps } from "@chakra-ui/react";
import { centsColor, formatCents } from "@/lib/intonation";

type PitchReadoutProps = FlexProps & {
  /** Note name, e.g. "B4". `null` while nothing is heard. */
  note: string | null;
  cents?: number | null;
  size?: "sm" | "lg";
  /** Show the "● Hearing" live indicator. */
  showListening?: boolean;
};

/** Detected note and its cents offset, coloured by intonation ("B4 +9¢"). */
export function PitchReadout({
  note,
  cents,
  size = "lg",
  showListening,
  ...rest
}: PitchReadoutProps) {
  const lg = size === "lg";
  const hasCents = note != null && cents != null;
  return (
    <Flex align="baseline" gap={lg ? "10px" : "6px"} {...rest}>
      {showListening && (
        <Flex as="span" align="center" gap="6px" fontSize="11px" color="fg.muted">
          <Box boxSize="7px" borderRadius="full" bg={note ? "intonation.good" : "border.strong"} />
          {note ? "Hearing" : "Listening"}
        </Flex>
      )}
      <Text as="span" fontFamily="heading" fontSize={lg ? "46px" : "24px"} lineHeight={1}>
        {note ?? "—"}
      </Text>
      {hasCents && (
        <Text
          as="span"
          fontSize={lg ? "16px" : "13px"}
          fontVariantNumeric="tabular-nums"
          style={{ color: centsColor(cents) }}
        >
          {formatCents(cents)}
        </Text>
      )}
    </Flex>
  );
}
