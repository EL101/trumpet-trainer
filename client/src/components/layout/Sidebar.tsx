import { Box, chakra, Flex, Grid, Text } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";
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
    borderRadius: "md",
    color: "fg",
    textDecoration: "none",
    "& .tt-nav-number": { color: "fg.faint" },
    _hover: { bg: "bg.hover" },
    "&[aria-current=page]": {
      color: "accent.fg",
      boxShadow: "inset 0 0 0 1px {colors.accent.solid}",
      _hover: { bg: "transparent" },
      "& .tt-nav-number": { color: "inherit" },
    },
  },
});

/** Left rail: brand, numbered nav, streak week and the profile link. */
export function Sidebar({ items = NAV_ITEMS, streak }: SidebarProps) {
  return (
    <Flex
      as="aside"
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

      <Flex as="nav" direction="column" gap="3px">
        {items.map((item, i) => (
          <SidebarLink key={item.to} to={item.to}>
            <Text
              as="span"
              className="tt-nav-number"
              fontSize="11px"
              fontVariantNumeric="tabular-nums"
              width="16px"
            >
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text as="span" fontFamily="heading" fontWeight={600} fontSize="19px" lineHeight={1.2}>
              {item.label}
            </Text>
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
