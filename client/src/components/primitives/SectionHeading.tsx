import { Flex, Heading, Text, type FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { toRoman } from "@/lib/format";

type SectionHeadingProps = FlexProps & {
  title: ReactNode;
  /** Renders a roman numeral before the title ("II. Listening"). */
  number?: number;
  description?: ReactNode;
  as?: "h2" | "h3" | "h4";
};

/** Numbered section heading with an optional muted description underneath. */
export function SectionHeading({
  title,
  number,
  description,
  as = "h3",
  ...rest
}: SectionHeadingProps) {
  return (
    <Flex direction="column" gap="2px" {...rest}>
      <Heading as={as} textStyle="heading.md" m={0}>
        {number != null && (
          <Text as="span" color="accent.fg" mr="0.35em">
            {toRoman(number)}.
          </Text>
        )}
        {title}
      </Heading>
      {description && (
        <Text fontSize="12px" color="fg.muted">
          {description}
        </Text>
      )}
    </Flex>
  );
}
