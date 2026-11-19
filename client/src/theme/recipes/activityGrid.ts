import { defineSlotRecipe } from "@chakra-ui/react";

/**
 * `ActivityGrid`: a year of days as squares in columns of weeks (mockup 4c's grid, with
 * 1k's month and weekday labels and key). The weeks share the width, each square at
 * least `--cell` across; narrower than that, the grid scrolls. A cell's shade comes
 * from its `data-level` (0–4); an empty day is only outlined. Mounting, the shaded days
 * pop in week by week, about half a second for a year.
 */
export const activityGridRecipe = defineSlotRecipe({
  className: "tt-activity-grid",
  slots: ["root", "months", "month", "weekdays", "cells", "cell", "legend"],
  base: {
    root: {
      "--cell": "11px",
      "--gap": "4px",
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      columnGap: "6px",
      rowGap: "6px",
      width: "100%",
      minWidth: "max-content",
      fontSize: "10px",
      lineHeight: 1,
      color: "fg.muted",
    },
    months: {
      gridColumn: "2",
      display: "grid",
      gridTemplateColumns: "repeat(var(--weeks), minmax(var(--cell), 1fr))",
      columnGap: "var(--gap)",
      height: "10px",
    },
    // No width of its own, so a name never widens its week; it runs on over the next.
    month: { width: 0, whiteSpace: "nowrap" },
    weekdays: {
      gridColumn: "1",
      display: "grid",
      gridTemplateRows: "repeat(7, minmax(0, 1fr))",
      rowGap: "var(--gap)",
      alignItems: "center",
      fontSize: "9px",
    },
    cells: {
      gridColumn: "2",
      display: "grid",
      gridAutoFlow: "column",
      gridTemplateColumns: "repeat(var(--weeks), minmax(var(--cell), 1fr))",
      gridTemplateRows: "repeat(7, auto)",
      gap: "var(--gap)",
      // The days played fill in left to right, a week at a time (`--week` is the
      // cell's column). Empty days are there from the start.
      "& > :not([data-level='0'])": {
        _motionSafe: {
          animation:
            "pop-in 100ms cubic-bezier(0.33, 1, 0.68, 1) calc(var(--week) * 5ms) backwards",
        },
      },
    },
    cell: {
      aspectRatio: "1",
      borderRadius: "2px",
      boxShadow: "inset 0 0 0 1px {colors.border}",
      "&[data-level='1']": { bg: "activity.1", boxShadow: "none" },
      "&[data-level='2']": { bg: "activity.2", boxShadow: "none" },
      "&[data-level='3']": { bg: "activity.3", boxShadow: "none" },
      "&[data-level='4']": { bg: "activity.4", boxShadow: "none" },
      // Keeps its place in the week, outside the span or still to come.
      "&[data-outside]": { visibility: "hidden" },
    },
    legend: {
      gridColumn: "2",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "4px",
      "& > [data-level]": { boxSize: "var(--cell)" },
      "& > :first-child": { me: "4px" },
      "& > :last-child": { ms: "4px" },
    },
  },
});
