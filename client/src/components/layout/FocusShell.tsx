import { Box, Flex, type BoxProps } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/primitives";

type FocusShellProps = Omit<BoxProps, "children"> & {
  children: ReactNode;
  back: { to: string; label: string };
  /** Right-hand side of the top bar (e.g. "3 of 6"). */
  actions?: ReactNode;
  /** A side drawer or bottom sheet rendered beside the main column. */
  aside?: ReactNode;
};

/** Distraction-free layout for the live player: no sidebar, a back link, optional drawer. */
export function FocusShell({ children, back, actions, aside, ...main }: FocusShellProps) {
  return (
    <Flex height="100vh" bg="bg" color="fg">
      <Flex direction="column" flex="1" minWidth={0}>
        <Flex align="center" justify="space-between" gap="lg" px="40px" pt="28px">
          <Button asChild variant="ghost">
            <Link to={back.to}>
              <ArrowLeft />
              {back.label}
            </Link>
          </Button>
          {actions}
        </Flex>
        <Box as="main" flex="1" minHeight={0} overflowY="auto" px="48px" py="28px" {...main}>
          {children}
        </Box>
      </Flex>
      {aside}
    </Flex>
  );
}
