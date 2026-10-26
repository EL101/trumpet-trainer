import { Box, Flex, type BoxProps } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { SIDEBAR_SLIDE, useSidebar } from "./useSidebar";

type AppShellProps = Omit<BoxProps, "children"> & {
  children: ReactNode;
  sidebar?: Omit<ComponentProps<typeof Sidebar>, "expanded" | "onToggle">;
};

/**
 * Collapsible sidebar + scrolling main column. Style props apply to <main> (default page
 * padding). Below `md` the sidebar starts collapsed, and opening it pushes the page off
 * the right edge at its own width and dims it, rather than squeezing it.
 */
export function AppShell({ children, sidebar, ...main }: AppShellProps) {
  const { expanded, covering, toggle, close } = useSidebar();
  return (
    <Flex height="100vh" overflow="clip" bg="bg" color="fg">
      <Sidebar {...sidebar} expanded={expanded} onToggle={toggle} />
      <Box
        position="relative"
        flex={{ base: "none", md: "1" }}
        width={{ base: "calc(100% - {sizes.sidebarRail})", md: "auto" }}
        minWidth={0}
      >
        <Box
          as="main"
          height="100%"
          overflowY="auto"
          // Keeps the page's own z-indexes under the dimming.
          isolation="isolate"
          inert={covering}
          px="56px"
          py="52px"
          {...main}
        >
          {children}
        </Box>
        <Box
          hideFrom="md"
          aria-hidden
          position="absolute"
          inset={0}
          bg="bg.backdrop"
          opacity={covering ? 1 : 0}
          pointerEvents={covering ? "auto" : "none"}
          _motionSafe={{ transition: `opacity ${SIDEBAR_SLIDE}` }}
          onClick={close}
        />
      </Box>
    </Flex>
  );
}
