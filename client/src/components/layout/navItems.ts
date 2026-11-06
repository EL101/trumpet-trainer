export type NavItem = { to: string; label: string };

/**
 * Primary navigation. The mockups list Today, Generate, Library and Progress, and keep
 * the tuner and metronome in the player's drawer; Tools has them too, to use on their
 * own. Today and Progress are hidden until they're built.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // { to: "/today", label: "Today" },
  { to: "/generate", label: "Generate" },
  { to: "/library", label: "Library" },
  // { to: "/progress", label: "Progress" },
  { to: "/tools", label: "Tools" },
];
