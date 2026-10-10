/**
 * Raw colour values for the Classical design system.
 *
 * This is the ONLY file in src/ allowed to contain colour literals (enforced by ESLint).
 * Components never import from here directly — they use the semantic tokens built in
 * roles.ts (via Chakra props like `color="fg.muted"`), or `roles` for non-CSS consumers
 * such as VexFlow.
 *
 * Ramps are the OKLCH-generated 100–900 steps from the design system's styles.css. The
 * design system is mono-accent, so its machine-derived `accent-2` ramp is omitted.
 */
export const palette = {
  paper: "#f3f2f2",
  vellum: "#eae9e9",
  ink: "#201f1d",

  neutral: {
    100: "#f8f4f4",
    200: "#eae7e7",
    300: "#d7d3d3",
    400: "#bab6b6",
    500: "#9b9797",
    600: "#7d7979",
    700: "#605d5d",
    800: "#444141",
    900: "#2d2b2b",
  },

  brass: {
    base: "#b68235",
    100: "#fff3e4",
    200: "#ffe3bf",
    300: "#facb8d",
    400: "#e1ad66",
    500: "#c28d41",
    600: "#a06f24",
    700: "#7d5411",
    800: "#5a3b0a",
    900: "#3a270d",
  },

  /** Intonation / score scale from the mockups: green (in tune) → ochre (~15¢) → red (35¢+). */
  pitch: {
    green: "#3e7a5e",
    olive: "#6d7445",
    ochre: "#a06f24",
    red: "#a84a33",
  },
} as const;
