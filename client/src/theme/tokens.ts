import { defineSemanticTokens, defineTokens } from "@chakra-ui/react";
import { palette } from "./palette";
import { roles } from "./roles";

type TokenTree = { [key: string]: string | TokenTree };
type ValueTree = { [key: string]: { value: string } | ValueTree };

/** Wraps every leaf of a plain object in Chakra's `{ value }` token shape. */
function toTokens(tree: TokenTree): ValueTree {
  return Object.fromEntries(
    Object.entries(tree).map(([k, v]) => [k, typeof v === "string" ? { value: v } : toTokens(v)]),
  );
}

const shadowInk = (percent: number) =>
  `color-mix(in srgb, ${palette.neutral[900]} ${percent}%, transparent)`;

export const tokens = defineTokens({
  colors: toTokens({
    paper: palette.paper,
    vellum: palette.vellum,
    ink: palette.ink,
    neutral: palette.neutral,
    brass: palette.brass,
  }),
  fonts: {
    heading: { value: `"Cormorant Garamond", Georgia, serif` },
    body: { value: `"Lora", Georgia, serif` },
  },
  // The design system's spacing scale (density 1.15 baked in). Named so it doesn't
  // collide with Chakra's numeric 4px scale that legacy pages still use.
  spacing: {
    xs: { value: "4.6px" },
    sm: { value: "9.2px" },
    md: { value: "13.8px" },
    lg: { value: "18.4px" },
    xl: { value: "27.6px" },
    "2xl": { value: "36.8px" },
  },
  radii: {
    sm: { value: "2px" },
    md: { value: "4px" },
    lg: { value: "7px" },
    // Chakra's built-in recipes use l1–l3.
    l1: { value: "2px" },
    l2: { value: "4px" },
    l3: { value: "7px" },
  },
  shadows: {
    sm: { value: `0 1px 2px ${shadowInk(14)}` },
    md: { value: `0 3px 10px ${shadowInk(16)}` },
    lg: { value: `0 12px 32px ${shadowInk(22)}` },
  },
  sizes: {
    sidebar: { value: "224px" },
  },
});

export const semanticTokens = defineSemanticTokens({
  colors: toTokens(roles),
});
