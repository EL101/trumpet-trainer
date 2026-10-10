export type NavItem = { to: string; label: string };

/** Primary navigation from the mockups. Tuner and metronome live inside the player. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/today", label: "Today" },
  { to: "/generate", label: "Generate" },
  { to: "/library", label: "Library" },
  { to: "/progress", label: "Progress" },
];
