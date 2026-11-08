import { Box, createSlotRecipeContext, type HTMLChakraProps } from "@chakra-ui/react";
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { activityGridRecipe } from "@/theme";
import { activityWeeks, monthLabels, type ActivityCell, type ActivityLevel } from "@/lib/activity";

const { withProvider, withContext } = createSlotRecipeContext({ recipe: activityGridRecipe });

const Root = withProvider<HTMLDivElement, HTMLChakraProps<"div">>("div", "root");
const Months = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "months");
const Month = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "month");
const Weekdays = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "weekdays");
const Cells = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "cells");
const Cell = withContext<HTMLSpanElement, HTMLChakraProps<"span">>("span", "cell");
const Legend = withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "legend");

const WEEKDAYS = ["M", "", "W", "", "F", "", "S"];
const LEVELS: ActivityLevel[] = [0, 1, 2, 3, 4];

type ActivityGridProps = Omit<HTMLChakraProps<"div">, "children"> & {
  /** How much happened each day, by date (YYYY-MM-DD); days missing count 0. */
  counts: ReadonlyMap<string, number>;
  /** The first and last day shown (see `pastYear` and `calendarYear` in lib/activity). */
  start: string;
  end: string;
  /** Today, in the user's time zone: the days after it aren't drawn. */
  today: string;
  /** A day's tooltip, e.g. "3 exercises played on 8 November 2026". */
  describe: (cell: ActivityCell) => string;
  /** What the grid shows, for screen readers, e.g. a summary of the year. */
  "aria-label": string;
};

/**
 * A span of activity (a year) as a grid of days, one column per week with Monday on
 * top, each day shaded by its count: like a GitHub contributions graph. The weeks share
 * the width; too narrow for them (a phone), it scrolls sideways, starting at the end.
 */
export function ActivityGrid({
  counts,
  start,
  end,
  today,
  describe,
  "aria-label": label,
  ...rest
}: ActivityGridProps) {
  const grid = useMemo(() => activityWeeks(start, end, today, counts), [start, end, today, counts]);
  const months = useMemo(() => monthLabels(grid, start, end), [grid, start, end]);

  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [start, end]);

  return (
    <Box ref={scroller} overflowX="auto" overflowY="hidden" maxWidth="100%" {...rest}>
      <Root style={{ "--weeks": grid.length } as CSSProperties}>
        <Months aria-hidden="true">
          {months.map(({ column, label }) => (
            <Month key={column} gridColumn={column + 1}>
              {label}
            </Month>
          ))}
        </Months>
        <Weekdays aria-hidden="true">
          {WEEKDAYS.map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </Weekdays>
        <Cells role="img" aria-label={label}>
          {grid.flat().map((cell) => (
            <Cell
              key={cell.date}
              data-level={cell.level}
              data-outside={cell.outside}
              title={cell.outside ? undefined : describe(cell)}
            />
          ))}
        </Cells>
        <Legend aria-hidden="true">
          <span>Less</span>
          {LEVELS.map((level) => (
            <Cell key={level} data-level={level} />
          ))}
          <span>More</span>
        </Legend>
      </Root>
    </Box>
  );
}
