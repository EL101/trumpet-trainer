import { Text, type TextProps } from "@chakra-ui/react";

type KickerProps = TextProps & { tone?: "accent" | "muted" };

/** Small uppercase tracked label above a heading ("Friday, 9 October", "Exercise 3 of 6"). */
export function Kicker({ tone = "accent", ...rest }: KickerProps) {
  return (
    <Text
      textStyle="kicker"
      color={tone === "accent" ? "accent.fg" : "fg.muted"}
      letterSpacing={tone === "muted" ? "0.12em" : undefined}
      {...rest}
    />
  );
}
