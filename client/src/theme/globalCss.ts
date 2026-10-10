import { defineGlobalStyles } from "@chakra-ui/react";

export const globalCss = defineGlobalStyles({
  "html, body": {
    bg: "bg",
    color: "fg",
    fontFamily: "body",
    fontSize: "15px",
    lineHeight: 1.55,
  },
  "h1, h2, h3, h4, h5, h6": {
    fontFamily: "heading",
    fontWeight: 600,
    lineHeight: 1.12,
    letterSpacing: "-0.015em",
  },
  "*:focus-visible": {
    outline: "2px solid {colors.accent.solid}",
    outlineOffset: "2px",
  },
  "::selection": {
    bg: "accent.selection",
  },
});
