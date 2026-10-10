import { defineSlotRecipe } from "@chakra-ui/react";

/** `.card` — bordered, unfilled content surface. */
export const cardRecipe = defineSlotRecipe({
  className: "tt-card",
  slots: ["root", "kicker", "title", "body", "meta"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "sm",
      borderWidth: "1px",
      borderColor: "border",
      borderRadius: "md",
      bg: "transparent",
      minWidth: 0,
    },
    kicker: {
      fontSize: "10px",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "accent.fg",
    },
    title: { fontFamily: "heading", fontWeight: 600, fontSize: "17px", lineHeight: 1.2 },
    body: { m: 0, fontSize: "13px", opacity: 0.8, flex: 1 },
    meta: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "11px",
      color: "fg.muted",
    },
  },
  variants: {
    size: {
      sm: { root: { p: "md" } },
      md: { root: { p: "16px", gap: "6px" } },
      lg: { root: { p: "24px", gap: "10px" }, title: { fontSize: "27px", lineHeight: 1.12 } },
    },
    elevation: {
      none: {},
      sm: { root: { boxShadow: "sm" } },
      md: { root: { boxShadow: "md" } },
    },
    interactive: {
      true: {
        root: {
          cursor: "pointer",
          transitionProperty: "border-color, background-color",
          transitionDuration: "fast",
          _hover: { borderColor: "border.emphasized" },
        },
      },
    },
    selected: {
      true: {
        root: { borderColor: "accent.solid", boxShadow: "inset 0 0 0 1px {colors.accent.solid}" },
      },
    },
  },
  defaultVariants: { size: "sm", elevation: "none" },
});
