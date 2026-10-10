import { Box, Flex, type BoxProps } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";
import { Sidebar } from "./Sidebar";

type AppShellProps = Omit<BoxProps, "children"> & {
  children: ReactNode;
  sidebar?: ComponentProps<typeof Sidebar>;
};

/** Sidebar + scrolling main column. Style props apply to <main> (default page padding). */
export function AppShell({ children, sidebar, ...main }: AppShellProps) {
  return (
    <Flex height="100vh" bg="bg" color="fg">
      <Sidebar {...sidebar} />
      <Box as="main" flex="1" minWidth={0} overflowY="auto" px="56px" py="52px" {...main}>
        {children}
      </Box>
    </Flex>
  );
}
