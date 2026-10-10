import { defineSlotRecipe } from "@chakra-ui/react";

/** Visually hidden native input, still focusable and announced. */
const hiddenInput = {
  position: "absolute",
  opacity: 0,
  width: 0,
  height: 0,
  pointerEvents: "none",
} as const;

/** `.seg` + `.seg-opt` — segmented control built on native radios. */
export const segmentedRecipe = defineSlotRecipe({
  className: "tt-segmented",
  slots: ["root", "item", "input"],
  base: {
    root: {
      display: "inline-flex",
      overflow: "hidden",
      borderWidth: "1px",
      borderColor: "border",
      borderRadius: "md",
    },
    item: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      px: "12px",
      py: "7px",
      fontSize: "13px",
      cursor: "pointer",
      whiteSpace: "nowrap",
      "& + &": { borderLeftWidth: "1px", borderLeftColor: "border" },
      "&:has(input:checked)": {
        color: "accent.solid",
        boxShadow: "inset 0 0 0 1px {colors.accent.solid}",
      },
      "&:not(:has(input:checked)):hover": { bg: "bg.hover" },
      "&:has(input:focus-visible)": {
        outline: "2px solid {colors.accent.solid}",
        outlineOffset: "-2px",
      },
      "&:has(input:disabled)": { opacity: 0.45, cursor: "not-allowed" },
    },
    input: hiddenInput,
  },
  variants: {
    fullWidth: {
      true: { root: { display: "flex", width: "100%" }, item: { flex: 1 } },
    },
  },
});

/** `.radio` + `.dot` — a single-choice list. */
export const radioRecipe = defineSlotRecipe({
  className: "tt-radio",
  slots: ["root", "item", "input", "dot"],
  base: {
    root: { display: "flex", flexDirection: "column", gap: "9px" },
    item: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      fontSize: "14px",
      "&:hover .tt-radio__dot": { borderColor: "accent.solid" },
    },
    input: hiddenInput,
    dot: {
      boxSize: "16px",
      flex: "none",
      borderRadius: "full",
      borderWidth: "1.5px",
      borderColor: "border",
      "input:checked + &": {
        borderColor: "accent.solid",
        bg: "accent.solid",
        boxShadow: "inset 0 0 0 4px {colors.bg}",
      },
      "input:focus-visible + &": {
        outline: "2px solid {colors.accent.solid}",
        outlineOffset: "2px",
      },
    },
  },
  variants: {
    orientation: {
      vertical: {},
      horizontal: { root: { flexDirection: "row", flexWrap: "wrap", gap: "18px" } },
    },
  },
  defaultVariants: { orientation: "vertical" },
});
