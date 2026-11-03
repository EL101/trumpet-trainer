import { Box, Flex, Grid, type BoxProps } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/primitives";

type FocusShellProps = Omit<BoxProps, "children" | "title"> & {
  children: ReactNode;
  /** The page to go back to. `state` rides along as its router state. */
  back: { to: string; label: string; state?: unknown };
  /** Centre of the top bar: what's being practised. */
  title?: ReactNode;
  /** Right-hand side of the top bar (e.g. "3 of 6"). */
  actions?: ReactNode;
  /** A drawer beside the main column, or below it on narrow screens. */
  aside?: ReactNode;
};

/**
 * Distraction-free layout for the player: no sidebar, a top bar with a back link and
 * the title, and an optional drawer. Style props apply to <main>.
 */
export function FocusShell({ children, back, title, actions, aside, ...main }: FocusShellProps) {
  return (
    <Flex direction="column" height="100dvh" bg="bg" color="fg">
      <Grid
        as="header"
        flex="none"
        templateColumns="1fr auto 1fr"
        alignItems="center"
        gap="md"
        minHeight="64px"
        px={{ base: "md", md: "28px" }}
        borderBottomWidth="1px"
        borderColor="border"
      >
        <Button asChild variant="ghost" justifySelf="start">
          <Link to={back.to} state={back.state}>
            <ArrowLeft />
            {back.label}
          </Link>
        </Button>
        <Box minWidth={0} textAlign="center">
          {title}
        </Box>
        <Flex justifySelf="end">{actions}</Flex>
      </Grid>
      <Flex
        flex="1"
        minHeight={0}
        direction={{ base: "column", lg: "row" }}
        overflowY={{ base: "auto", lg: "hidden" }}
      >
        <Box
          as="main"
          flex={{ base: "none", lg: "1" }}
          minWidth={0}
          overflowY={{ lg: "auto" }}
          px={{ base: "md", md: "44px" }}
          py={{ base: "xl", md: "2xl" }}
          {...main}
        >
          {children}
        </Box>
        {aside}
      </Flex>
    </Flex>
  );
}
