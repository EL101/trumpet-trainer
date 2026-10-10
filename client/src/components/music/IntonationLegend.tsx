import { Box, Flex, type FlexProps } from "@chakra-ui/react";
import { CENTS_GRADIENT, MAX_CENTS } from "@/lib/intonation";

/** "In tune ▬▬▬ 35¢ off" — the key for note colouring. */
export function IntonationLegend({
  barWidth = "120px",
  ...rest
}: FlexProps & { barWidth?: string }) {
  return (
    <Flex align="center" gap="10px" fontSize="11px" color="fg.muted" {...rest}>
      <span>In tune</span>
      <Box
        width={barWidth}
        height="4px"
        borderRadius="2px"
        style={{ background: CENTS_GRADIENT }}
      />
      <span>{MAX_CENTS}¢ off</span>
    </Flex>
  );
}
