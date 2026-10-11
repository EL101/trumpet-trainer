import { Box, chakra, Flex, Grid, Text } from "@chakra-ui/react";
import { useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Rule, Stat } from "@/components/primitives";
import UserAvatar from "@/components/UserAvatar";
import { useProfile } from "@/profile/useProfile";
import { NAV_ITEMS, type NavItem } from "./navItems";

export type StreakDay = { label: string; state: "done" | "today" | "missed" };

type SidebarProps = {
  items?: readonly NavItem[];
  streak?: { days: number; week: readonly StreakDay[] };
};

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

/** Left rail: brand, numbered nav, streak week and the profile link. */
export function Sidebar({ items = NAV_ITEMS, streak }: SidebarProps) {
  const { asideRef, outlineRef } = useSidebarMotion();
  return (
    <Flex
      as="aside"
      ref={asideRef}
      direction="column"
      gap="22px"
      width="sidebar"
      flex="none"
      height="100%"
      borderRightWidth="1px"
      borderColor="border"
      pt="34px"
      px="20px"
      pb="22px"
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
        <Text fontSize="10px" letterSpacing="0.14em" textTransform="uppercase" color="accent.fg">
          Daily practice
        </Text>
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
