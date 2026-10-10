import { defineRecipe } from "@chakra-ui/react";

/** `.input` — shared by text inputs, textareas and native selects. */
export const inputRecipe = defineRecipe({
  className: "tt-input",
  base: {
    width: "100%",
    minHeight: "36px",
    px: "10px",
    py: "6px",
    font: "inherit",
    fontSize: "14px",
    color: "fg",
    caretColor: "accent.solid",
    bg: "transparent",
    borderWidth: "1px",
    borderColor: "border",
    borderRadius: "md",
    appearance: "none",
    _hover: { borderColor: "border.emphasized" },
    _focusVisible: { borderColor: "accent.solid", outlineOffset: 0 },
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
    _placeholder: { color: "fg.subtle" },
  },
});

export const textareaRecipe = defineRecipe({
  className: "tt-textarea",
  base: { ...inputRecipe.base, minHeight: "90px", resize: "vertical" },
});
