import { defineTextStyles } from "@chakra-ui/react";

const heading = { fontFamily: "heading" } as const;
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * Type scale distilled from the mockups. Display sizes use the normal cut (the design
 * system lightens type as it grows); interface headings cap at semibold.
 */
export const textStyles = defineTextStyles({
  display: {
    /** Title-page headline (the landing page). */
    xl: {
      value: {
        ...heading,
        fontSize: "68px",
        fontWeight: 400,
        lineHeight: 1.06,
        letterSpacing: "-0.015em",
      },
    },
    lg: {
      value: {
        ...heading,
        fontSize: "56px",
        fontWeight: 400,
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
      },
    },
    md: {
      value: {
        ...heading,
        fontSize: "46px",
        fontWeight: 400,
        lineHeight: 1.08,
        letterSpacing: "-0.02em",
      },
    },
    sm: {
      value: {
        ...heading,
        fontSize: "38px",
        fontWeight: 400,
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
      },
    },
  },
  heading: {
    lg: { value: { ...heading, fontSize: "27px", fontWeight: 600, lineHeight: 1.12 } },
    md: { value: { ...heading, fontSize: "20px", fontWeight: 600, lineHeight: 1.2 } },
    sm: { value: { ...heading, fontSize: "16px", fontWeight: 600, lineHeight: 1.25 } },
  },
  /** Italic heading-face subtitle, e.g. "B♭ trumpet · since 2 June 2026". */
  epigraph: {
    value: { ...heading, fontStyle: "italic", fontSize: "17px" },
  },
  /** Small uppercase tracked label above a heading ("Friday, 9 October", "Up next · 03"). */
  kicker: {
    value: {
      fontSize: "11px",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      lineHeight: 1.3,
    },
  },
  body: { value: { fontSize: "15px", lineHeight: 1.55 } },
  meta: { value: { fontSize: "12px", lineHeight: 1.4 } },
  caption: { value: { fontSize: "11px", lineHeight: 1.35 } },
  /** Large tabular numerals for stats and scores. */
  figure: {
    lg: { value: { ...heading, ...tabular, fontSize: "38px", fontWeight: 400, lineHeight: 1 } },
    md: { value: { ...heading, ...tabular, fontSize: "34px", fontWeight: 400, lineHeight: 1 } },
    sm: { value: { ...heading, ...tabular, fontSize: "24px", fontWeight: 400, lineHeight: 1.1 } },
  },
});
