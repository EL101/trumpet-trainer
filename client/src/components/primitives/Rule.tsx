import { Box, type BoxProps } from "@chakra-ui/react";

type RuleProps = BoxProps & {
  orientation?: "horizontal" | "vertical";
  /** `accent` draws the short gold dash used under titles. */
  tone?: "divider" | "accent";
};

/** `.hr` — a hairline rule. */
export function Rule({ orientation = "horizontal", tone = "divider", ...rest }: RuleProps) {
  const horizontal = orientation === "horizontal";
  return (
    <Box
      role="separator"
      aria-orientation={orientation}
      flexShrink={0}
      bg={tone === "accent" ? "accent.solid" : "border"}
      {...(horizontal ? { height: "1px", width: "100%" } : { width: "1px", alignSelf: "stretch" })}
      {...rest}
    />
  );
}
