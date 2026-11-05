export type NavItem = { to: string; label: string };

/**
 * Primary navigation. The mockups list Today, Generate, Library and Progress, and keep
 * the tuner in the player's drawer; it stays here too so it can be used on its own.
 * Today and Progress are hidden until they're built.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // { to: "/today", label: "Today" },
  { to: "/generate", label: "Generate" },
  { to: "/library", label: "Library" },
  // { to: "/progress", label: "Progress" },
  { to: "/tuner", label: "Tuner" },
];
