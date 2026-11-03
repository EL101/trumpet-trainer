import { defineRecipe } from "@chakra-ui/react";

const thumb = {
  boxSize: "14px",
  borderRadius: "full",
  bg: "bg",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "accent.solid",
  transitionProperty: "background-color",
  transitionDuration: "fast",
} as const;

/**
 * A native range input drawn as the mockups' slider: a hairline track, filled in the
 * accent up to an outlined round thumb. The fill reads `--fill` (a percentage), which
 * `Slider` sets from its value.
 */
export const sliderRecipe = defineRecipe({
  className: "tt-slider",
  base: {
    appearance: "none",
    display: "block",
    width: "100%",
    height: "16px",
    m: 0,
    bg: "transparent",
    cursor: "pointer",
    "&::-webkit-slider-runnable-track": {
      height: "2px",
      borderRadius: "full",
      background:
        "linear-gradient(to right, {colors.accent.solid} var(--fill), {colors.border.strong} var(--fill))",
    },
    "&::-webkit-slider-thumb": { ...thumb, appearance: "none", mt: "-6px" },
    "&::-moz-range-track": { height: "1px", bg: "border.strong" },
    "&::-moz-range-progress": { height: "2px", bg: "accent.solid" },
    "&::-moz-range-thumb": thumb,
    "&:hover::-webkit-slider-thumb": { bg: "accent.subtle" },
    "&:hover::-moz-range-thumb": { bg: "accent.subtle" },
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
  },
});
