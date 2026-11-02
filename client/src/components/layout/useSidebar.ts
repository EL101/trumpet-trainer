import { useBreakpointValue } from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

/** How the sidebar opens and closes, and how the page and its dimming follow it. */
export const SIDEBAR_SLIDE = "300ms cubic-bezier(0.2, 0, 0, 1)";

/**
 * Whether a phone-width sidebar is open on screen. Each page mounts its own AppShell, so
 * following a link in the open sidebar swaps it for a new one. The new one starts open
 * from this and then closes, so the sidebar slides shut over the new page instead of
 * vanishing.
 */
let openOnPhone = false;

/**
 * Open/closed state for AppShell's sidebar. From `md` up it starts open and remembers
 * being collapsed. Below `md` it starts as a rail, and once opened it covers the page
 * until the viewer taps the page, presses Escape or goes to another page.
 */
export function useSidebar() {
  const narrow = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false;
  const [collapsed, setCollapsed] = usePersistedState("sidebarCollapsed", false);
  const [arrivedOpen] = useState(() => openOnPhone);
  const [openNarrow, setOpenNarrow] = useState(arrivedOpen);
  const covering = narrow && openNarrow;

  useLayoutEffect(() => {
    openOnPhone = covering;
    return () => {
      openOnPhone = false;
    };
  }, [covering]);

  useLayoutEffect(() => {
    if (!arrivedOpen) return;
    // Lay out the open sidebar before closing it, so the browser runs the transition
    // instead of jumping straight to closed.
    document.body.getBoundingClientRect();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the close has to follow a styled open frame
    setOpenNarrow(false);
  }, [arrivedOpen]);

  useEffect(() => {
    if (!covering) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenNarrow(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [covering]);

  return {
    expanded: narrow ? openNarrow : !collapsed,
    /** The open sidebar is lying over a dimmed page (below `md` only). */
    covering,
    toggle: () => (narrow ? setOpenNarrow((open) => !open) : setCollapsed((c) => !c)),
    close: () => setOpenNarrow(false),
  };
}
