import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * `.toast`: a small notice in the bottom-right corner. A hairline card on the panel
 * colour, never a coloured fill; the type shows only in the icon's colour.
 */
export const toastRecipe = defineSlotRecipe({
  className: "tt-toast",
  slots: ["root", "indicator", "title", "description", "action", "closeTrigger"],
  base: {
    root: {
      width: { base: "full", md: "360px" },
      display: "flex",
      alignItems: "flex-start",
      position: "relative",
      gap: "sm",
      py: "md",
      ps: "md",
      pe: "xl",
      bg: "bg.panel",
      color: "fg",
      borderWidth: "1px",
      borderColor: "border",
      borderRadius: "md",
      boxShadow: "md",
      // Stacking and motion, driven by the variables Chakra's toaster sets.
      translate: "var(--x) var(--y)",
      scale: "var(--scale)",
      zIndex: "var(--z-index)",
      height: "var(--height)",
      opacity: "var(--opacity)",
      willChange: "translate, opacity, scale",
      transition: "translate 400ms, scale 400ms, opacity 400ms, height 400ms",
      transitionTimingFunction: "cubic-bezier(0.21, 1.02, 0.73, 1)",
      _closed: {
        transition: "translate 400ms, scale 400ms, opacity 200ms",
        transitionTimingFunction: "cubic-bezier(0.06, 0.71, 0.55, 1)",
      },
      "--toast-icon": "colors.fg.muted",
      "&[data-type=success]": { "--toast-icon": "colors.accent.solid" },
      "&[data-type=error]": { "--toast-icon": "colors.fg.error" },
    },
    indicator: {
      flexShrink: 0,
      display: "inline-flex",
      color: "var(--toast-icon)",
      mt: "2px",
      _icon: { boxSize: "18px" },
    },
    title: { fontFamily: "heading", fontWeight: 600, fontSize: "17px", lineHeight: 1.2 },
    description: { fontSize: "13px", color: "fg.muted", mt: "xs" },
    action: { mt: "sm", alignSelf: "flex-start" },
    closeTrigger: {
      position: "absolute",
      top: "xs",
      insetEnd: "xs",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      p: "xs",
      color: "fg.subtle",
      borderRadius: "sm",
      cursor: "pointer",
      transition: "color 200ms",
      _hover: { color: "fg" },
      _icon: { boxSize: "14px" },
    },
  },
});
