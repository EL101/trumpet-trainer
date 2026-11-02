import { Box, chakra, Flex, Grid, Text } from "@chakra-ui/react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IconButton, Rule, Stat } from "@/components/primitives";
import UserAvatar from "@/components/UserAvatar";
import { useProfile } from "@/profile/useProfile";
import { NAV_ITEMS, type NavItem } from "./navItems";
import { SIDEBAR_SLIDE } from "./useSidebar";

export type StreakDay = { label: string; state: "done" | "today" | "missed" };

type SidebarProps = {
  items?: readonly NavItem[];
  streak?: { days: number; week: readonly StreakDay[] };
  /** Full width, or folded down to a spine that opens it again. */
  expanded?: boolean;
  /** Shows the collapse/expand button. */
  onToggle?: () => void;
};

/** Open width: the design's on wide screens; on a phone, most of the screen. */
const OPEN_WIDTH = { base: "min(320px, 100vw - 72px)", md: "sidebar" };

const SidebarLink = chakra(NavLink, {
  base: {
    display: "flex",
    alignItems: "baseline",
    gap: "12px",
    px: "10px",
    py: "8px",
    position: "relative",
    borderRadius: "md",
    color: "fg",
    textDecoration: "none",
    transitionProperty: "background-color",
    transitionDuration: "moderate",
    "& .tt-nav-number": { color: "fg.faint" },
    _hover: { bg: "bg.hover" },
    "&[aria-current=page]": {
      color: "accent.fg",
      _hover: { bg: "transparent" },
      "& .tt-nav-number": { color: "inherit" },
    },
  },
});

/**
 * The collapsed sidebar, drawn like a book's spine: the title runs up it between banded
 * rules. The whole spine is the button that opens the sidebar.
 */
const Spine = chakra("button", {
  base: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    width: "sidebarRail",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "18px",
    pt: "30px",
    pb: "22px",
    bg: "bg.panel",
    color: "fg",
    cursor: "pointer",
    "& svg": { boxSize: "14px", color: "accent.solid" },
    "& .tt-spine-title": { transitionProperty: "color", transitionDuration: "moderate" },
    _hover: { "& .tt-spine-title": { color: "accent.fg" } },
    // The sidebar clips its overflow, so keep the focus ring inside.
    _focusVisible: { outlineOffset: "-3px" },
  },
});

const EASE_OUT = "cubic-bezier(0.2, 0, 0, 1)";
/** The sidebar sliding in from the left when the viewer arrives. */
const ENTRANCE = { duration: 600, easing: EASE_OUT };
/** The active tab's outline moving to a newly clicked tab. */
const OUTLINE_SLIDE = { duration: 300, easing: EASE_OUT };

// Each page mounts its own AppShell, so every navigation swaps one sidebar for a new one
// in a single commit. These carry what the new sidebar needs to know about the old one.

/**
 * Sidebars on screen. An unmounting sidebar only counts itself out after the commit, so
 * a new one that sees zero has no predecessor: the viewer has just arrived, by loading
 * the page or signing in, rather than clicking a tab.
 */
let sidebarsOnScreen = 0;
/** Where the last sidebar's active outline sat, from the top of its nav. */
let lastOutlineTop: number | null = null;

/**
 * Left rail: brand, numbered nav, streak week and the profile link. Collapsing it slides
 * the edge in over its contents, which keep their width and fade out as a spine fades in.
 */
export function Sidebar({ items = NAV_ITEMS, streak, expanded = true, onToggle }: SidebarProps) {
  const { asideRef, outlineRef } = useSidebarMotion();
  const contentsId = useId();
  return (
    <Box
      as="aside"
      ref={asideRef}
      position="relative"
      flex="none"
      width={expanded ? OPEN_WIDTH : "sidebarRail"}
      height="100%"
      overflow="hidden"
      bg="bg"
      borderRightWidth="1px"
      borderColor="border"
      _motionSafe={{ transition: `width ${SIDEBAR_SLIDE}` }}
    >
      <Flex
        id={contentsId}
        inert={!expanded}
        direction="column"
        gap="22px"
        width={OPEN_WIDTH}
        height="100%"
        overflowY="auto"
        pt="34px"
        px="20px"
        pb="22px"
        opacity={expanded ? 1 : 0}
        _motionSafe={{
          // Out before the edge reaches the text; in once there's room for it.
          transition: expanded ? "opacity 200ms ease-out 100ms" : "opacity 120ms ease-in",
        }}
      >
        <Flex direction="column" gap="6px" px="10px">
          <Text
            fontFamily="heading"
            fontWeight={600}
            fontSize="24px"
            lineHeight={1.05}
            letterSpacing="-0.01em"
          >
            Trumpet Trainer
          </Text>
          <Flex align="center" justify="space-between" gap="sm">
            <Text
              fontSize="10px"
              letterSpacing="0.14em"
              textTransform="uppercase"
              color="accent.fg"
            >
              Daily practice
            </Text>
            {onToggle && (
              <IconButton
                variant="ghost"
                size="sm"
                // Hangs into the padding so the row keeps the kicker's height.
                my="-8px"
                me="-8px"
                aria-label="Collapse sidebar"
                aria-expanded
                aria-controls={contentsId}
                onClick={onToggle}
              >
                <ChevronsLeft />
              </IconButton>
            )}
          </Flex>
        </Flex>
        <Rule mx="10px" width="auto" />

        <Flex as="nav" position="relative" direction="column" gap="3px">
          {items.map((item, i) => (
            <SidebarLink key={item.to} to={item.to}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <Box
                      ref={outlineRef}
                      position="absolute"
                      inset={0}
                      zIndex={1}
                      borderRadius="inherit"
                      boxShadow="inset 0 0 0 1px {colors.accent.solid}"
                      pointerEvents="none"
                    />
                  )}
                  <Text
                    as="span"
                    className="tt-nav-number"
                    fontSize="11px"
                    fontVariantNumeric="tabular-nums"
                    width="16px"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                  <Text
                    as="span"
                    fontFamily="heading"
                    fontWeight={600}
                    fontSize="19px"
                    lineHeight={1.2}
                  >
                    {item.label}
                  </Text>
                </>
              )}
            </SidebarLink>
          ))}
        </Flex>

        <Flex direction="column" gap="14px" px="10px" mt="auto">
          {streak && (
            <>
              <Stat layout="inline" size="lg" value={streak.days} label="day streak" />
              <StreakWeek week={streak.week} />
              <Rule />
            </>
          )}
          <ProfileLink />
        </Flex>
      </Flex>

      {onToggle && (
        <Spine
          type="button"
          inert={expanded}
          aria-label="Expand sidebar"
          aria-expanded={false}
          aria-controls={contentsId}
          onClick={onToggle}
          opacity={expanded ? 0 : 1}
          _motionSafe={{
            // The reverse of the contents: in once they've gone, out before they return.
            transition: expanded ? "opacity 120ms ease-in" : "opacity 200ms ease-out 100ms",
          }}
        >
          <ChevronsRight />
          <SpineBands />
          <Text
            as="span"
            className="tt-spine-title"
            fontFamily="heading"
            fontWeight={600}
            fontSize="18px"
            letterSpacing="0.03em"
            whiteSpace="nowrap"
            css={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Trumpet Trainer
          </Text>
          <SpineBands />
          <Text
            as="span"
            mt="auto"
            fontSize="9px"
            letterSpacing="0.18em"
            textTransform="uppercase"
            whiteSpace="nowrap"
            color="accent.fg"
            css={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Daily practice
          </Text>
        </Spine>
      )}
    </Box>
  );
}

/**
 * Slides the sidebar in from the left when the viewer arrives, and otherwise slides the
 * active tab's outline over from where the previous sidebar had it. The outline lives
 * inside the active link, so it only moves while animating and always lines up with its
 * tab afterwards.
 */
function useSidebarMotion() {
  const asideRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const arriving = sidebarsOnScreen === 0;
    sidebarsOnScreen++;

    const outline = outlineRef.current;
    const from = arriving ? null : lastOutlineTop;
    // The active link's layout position within the nav. Unlike a bounding rect, it
    // ignores a slide that's already running.
    const to = outline?.parentElement?.offsetTop ?? null;
    lastOutlineTop = to;

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (arriving) {
        asideRef.current?.animate(
          [{ transform: "translateX(-100%)" }, { transform: "none" }],
          ENTRANCE,
        );
      } else if (outline && from !== null && to !== null && from !== to) {
        outline.animate(
          [{ transform: `translateY(${from - to}px)` }, { transform: "none" }],
          OUTLINE_SLIDE,
        );
      }
    }

    return () =>
      queueMicrotask(() => {
        sidebarsOnScreen--;
      });
  }, [pathname]);

  return { asideRef, outlineRef };
}

/** A pair of hairlines across the spine, like the raised bands on a bound book. */
function SpineBands() {
  return (
    <Flex direction="column" gap="3px" aria-hidden>
      <Box width="22px" height="1px" bg="border.emphasized" />
      <Box width="22px" height="1px" bg="border.emphasized" />
    </Flex>
  );
}

function StreakWeek({ week }: { week: readonly StreakDay[] }) {
  return (
    <Grid
      templateColumns="repeat(7, 1fr)"
      gap="4px"
      fontSize="9px"
      textAlign="center"
      color="fg.muted"
    >
      {week.map((d, i) => (
        <Flex key={i} direction="column" gap="4px" align="center">
          <Box
            boxSize="18px"
            borderRadius="full"
            borderStyle={d.state === "today" ? "dashed" : "solid"}
            borderWidth={d.state === "missed" ? "1px" : "1.25px"}
            borderColor={d.state === "missed" ? "border" : "accent.solid"}
            bg={d.state === "done" ? "accent.subtle" : undefined}
            aria-label={`${d.label}: ${d.state}`}
          />
          {d.label}
        </Flex>
      ))}
    </Grid>
  );
}

function ProfileLink() {
  const { profile } = useProfile();
  const isGuest = !profile || profile.isAnonymous;
  const name = isGuest ? "Guest" : (profile.displayName ?? "Player");
  return (
    <chakra.a
      asChild
      display="flex"
      alignItems="center"
      gap="10px"
      py="4px"
      color="fg"
      textDecoration="none"
      _hover={{ "& .tt-profile-name": { color: "accent.fg" } }}
    >
      <NavLink to="/profile">
        <UserAvatar size={32} src={profile?.avatarUrl} name={name} isGuest={isGuest} />
        <Flex direction="column" lineHeight={1.25}>
          <Text
            as="span"
            className="tt-profile-name"
            fontFamily="heading"
            fontWeight={600}
            fontSize="16px"
          >
            {name}
          </Text>
          <Text as="span" fontSize="11px" color="fg.muted">
            Profile and settings
          </Text>
        </Flex>
      </NavLink>
    </chakra.a>
  );
}
