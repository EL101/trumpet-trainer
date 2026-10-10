import { Flex, Heading, Text, type FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Kicker } from "@/components/primitives";

type PageHeaderProps = Omit<FlexProps, "title"> & {
  title: ReactNode;
  kicker?: ReactNode;
  /** Muted line under the title ("Six exercises · 27 minutes"). */
  subtitle?: ReactNode;
  /** Italic aside set on the title's baseline ("August to October"). */
  epigraph?: ReactNode;
  /** Right-aligned controls (filters, period toggles). */
  actions?: ReactNode;
  size?: "lg" | "md" | "sm";
};

/** Page title block: kicker, display-size heading, subtitle, actions on the right. */
export function PageHeader({
  title,
  kicker,
  subtitle,
  epigraph,
  actions,
  size = "md",
  ...rest
}: PageHeaderProps) {
  return (
    <Flex align="flex-end" justify="space-between" gap="lg" {...rest}>
      <Flex direction="column" gap="6px" minWidth={0}>
        {kicker && <Kicker>{kicker}</Kicker>}
        <Flex align="baseline" gap="16px" wrap="wrap">
          <Heading as="h1" textStyle={`display.${size}`} m={0}>
            {title}
          </Heading>
          {epigraph && (
            <Text textStyle="epigraph" fontSize="20px" color="fg.muted">
              {epigraph}
            </Text>
          )}
        </Flex>
        {subtitle && (
          <Text fontSize="14px" color="fg.muted">
            {subtitle}
          </Text>
        )}
      </Flex>
      {actions && (
        <Flex flex="none" gap="sm" align="center">
          {actions}
        </Flex>
      )}
    </Flex>
  );
}
