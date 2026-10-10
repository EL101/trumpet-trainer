import { defineRecipe } from "@chakra-ui/react";

/** `.tag` — small labels tinted from the ramps. */
export const tagRecipe = defineRecipe({
  className: "tt-tag",
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    letterSpacing: "0.02em",
    lineHeight: 1.4,
    px: "10px",
    py: "3px",
    borderRadius: "3px",
    whiteSpace: "nowrap",
  },
  variants: {
    variant: {
      accent: { bg: "accent.subtle", color: "accent.contrast" },
      neutral: { bg: "bg.subtle", color: "neutral.800" },
      outline: { borderWidth: "1px", borderColor: "accent.solid", color: "accent.solid" },
    },
  },
  defaultVariants: { variant: "accent" },
});
