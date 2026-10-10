import { defineSlotRecipe } from "@chakra-ui/react";

/** Double-ruled frame used for the sign-in panel and the profile practice record. */
export const bookplateRecipe = defineSlotRecipe({
  className: "tt-bookplate",
  slots: ["root", "inner"],
  base: {
    root: {
      borderWidth: "1px",
      borderColor: "accent.solid",
      borderRadius: "sm",
      p: "5px",
    },
    inner: {
      borderWidth: "1px",
      borderColor: "accent.muted",
    },
  },
  variants: {
    size: {
      md: { inner: { px: "28px", py: "24px" } },
      lg: { root: { p: "6px" }, inner: { px: "34px", pt: "40px", pb: "36px" } },
    },
  },
  defaultVariants: { size: "md" },
});
