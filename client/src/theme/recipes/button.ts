import { defineRecipe } from "@chakra-ui/react";

/** `.btn` — outlined, never filled. */
export const buttonRecipe = defineRecipe({
  className: "tt-button",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "heading",
    fontWeight: 600,
    lineHeight: 1.2,
    color: "fg",
    bg: "transparent",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: "md",
    whiteSpace: "nowrap",
    transitionProperty: "background-color, border-color, color",
    transitionDuration: "fast",
    "& svg": { display: "block", flexShrink: 0 },
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
  },
  variants: {
    variant: {
      primary: {
        color: "accent.solid",
        borderColor: "accent.solid",
        _hover: { bg: "accent.hover" },
        _active: { bg: "accent.pressed" },
      },
      secondary: {
        borderColor: "border",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.pressed" },
      },
      ghost: {
        color: "accent.solid",
        _hover: { bg: "accent.ghostHover" },
        _active: { bg: "accent.ghostPressed" },
      },
    },
    size: {
      sm: { fontSize: "13px", py: "7px", px: "14px", "& svg": { boxSize: "14px" } },
      md: {
        fontSize: "14px",
        py: "sm",
        px: "calc({spacing.md} * 1.2)",
        "& svg": { boxSize: "15px" },
      },
      lg: { fontSize: "16px", py: "12px", px: "28px", "& svg": { boxSize: "16px" } },
    },
    iconOnly: {
      true: { p: 0, flexShrink: 0 },
    },
    fullWidth: {
      true: { width: "100%" },
    },
  },
  compoundVariants: [
    { variant: "ghost", iconOnly: false, css: { px: "xs" } },
    { iconOnly: true, size: "sm", css: { boxSize: "30px" } },
    { iconOnly: true, size: "md", css: { boxSize: "36px" } },
    { iconOnly: true, size: "lg", css: { boxSize: "44px" } },
  ],
  defaultVariants: { variant: "secondary", size: "md", iconOnly: false, fullWidth: false },
});
