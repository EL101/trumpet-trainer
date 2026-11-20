import { defineSlotRecipe } from "@chakra-ui/react";

const thumb = {
  boxSize: "var(--range-thumb)",
  borderRadius: "full",
  bg: "bg",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "accent.fg",
  boxShadow: "0 1px 2px {colors.border}",
  cursor: "grab",
  pointerEvents: "auto",
  transitionProperty: "background-color",
  transitionDuration: "fast",
} as const;

/**
 * `RangeSlider`: two native range inputs laid over one hairline rail, with the stretch
 * between their thumbs filled in the accent. The inputs take no pointer events except on
 * their thumbs, so each thumb can be dragged on its own. `RangeAxis` labels the rail
 * with the same insets, so its marks line up with where the thumbs sit.
 */
export const rangeSliderRecipe = defineSlotRecipe({
  className: "tt-range-slider",
  slots: ["root", "rail", "band", "reference", "input", "axis", "mark"],
  base: {
    root: {
      "--range-thumb": "18px",
      position: "relative",
      height: "40px",
      minWidth: 0,
    },
    rail: {
      position: "absolute",
      insetInline: "calc(var(--range-thumb) / 2)",
      top: "calc(50% - 1px)",
      height: "2px",
      borderRadius: "full",
      bg: "border.muted",
    },
    band: {
      position: "absolute",
      top: "calc(50% - 7px)",
      height: "14px",
      bg: "accent.subtle",
      borderWidth: "1px",
      borderColor: "accent.solid",
      borderRadius: "sm",
    },
    reference: {
      position: "absolute",
      top: "calc(50% - 8px)",
      height: "16px",
      borderWidth: "1px",
      borderStyle: "dashed",
      borderColor: "border.strong",
      borderRadius: "sm",
    },
    input: {
      appearance: "none",
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      m: 0,
      bg: "transparent",
      pointerEvents: "none",
      outline: "none",
      "&::-webkit-slider-runnable-track": { height: "100%", bg: "transparent" },
      "&::-webkit-slider-thumb": {
        ...thumb,
        appearance: "none",
        mt: "calc((40px - var(--range-thumb)) / 2)",
      },
      "&::-moz-range-track": { bg: "transparent" },
      "&::-moz-range-thumb": thumb,
      "&:hover::-webkit-slider-thumb": { bg: "accent.subtle" },
      "&:hover::-moz-range-thumb": { bg: "accent.subtle" },
      "&:active::-webkit-slider-thumb": { cursor: "grabbing" },
      "&:active::-moz-range-thumb": { cursor: "grabbing" },
      "&:focus-visible::-webkit-slider-thumb": {
        outline: "2px solid {colors.accent.solid}",
        outlineOffset: "2px",
      },
      "&:focus-visible::-moz-range-thumb": {
        outline: "2px solid {colors.accent.solid}",
        outlineOffset: "2px",
      },
      _disabled: { "&::-webkit-slider-thumb": { cursor: "not-allowed" }, opacity: 0.45 },
    },
    axis: {
      "--range-thumb": "18px",
      position: "relative",
      height: "16px",
      fontSize: "11px",
      color: "fg.muted",
    },
    mark: { position: "absolute", top: 0, transform: "translateX(-50%)", whiteSpace: "nowrap" },
  },
});
