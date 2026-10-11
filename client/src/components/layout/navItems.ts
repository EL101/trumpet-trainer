export type NavItem = { to: string; label: string };

/**
 * Primary navigation. The mockups list only the first four and move the tuner and
 * metronome into a drawer inside the player; they stay here until that drawer exists.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/today", label: "Today" },
  { to: "/generate", label: "Generate" },
  { to: "/library", label: "Library" },
  { to: "/progress", label: "Progress" },
  { to: "/tuner", label: "Tuner" },
  { to: "/metronome", label: "Metronome" },
];
