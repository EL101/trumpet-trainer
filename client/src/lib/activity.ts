/**
 * The activity grid's layout: a year of days in columns of weeks, Monday at the top,
 * like a GitHub contributions graph. Dates are plain "YYYY-MM-DD" strings in the
 * user's time zone; the arithmetic is done in UTC so no day is skipped or repeated
 * over a clock change.
 */

/** Weeks the grid shows: a year, with the week it ends in. */
export const ACTIVITY_WEEKS = 53;

const DAY = 24 * 60 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * One day on the grid. A day `outside` the span shown (before its start, after its end,
 * or still to come) keeps its place in the week but isn't drawn.
 */
export type ActivityCell = { date: string; count: number; level: ActivityLevel; outside?: true };

/** How dark a day is drawn: 0 for nothing, up to 4. */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * A day's shade, from how many exercises were played: 1, 2–3, 4–6, 7 or more. Fixed
 * steps, so a day looks the same whatever the user's busiest day was.
 */
export function activityLevel(count: number): ActivityLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** Today in the user's time zone, as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const parse = (date: string) => Date.parse(`${date}T00:00:00Z`);
const format = (time: number) => new Date(time).toISOString().slice(0, 10);

/** The span "Past year" shows: 53 weeks, Monday first, ending with today's week. */
export function pastYear(today: string): [string, string] {
  const end = parse(today);
  const monday = end - ((new Date(end).getUTCDay() + 6) % 7) * DAY;
  return [format(monday - (ACTIVITY_WEEKS - 1) * 7 * DAY), today];
}

/** The span a calendar year shows: 1 January to 31 December. */
export function calendarYear(year: number): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}

/**
 * The grid: columns of seven days, Monday first, from the week `start` is in to the
 * week `end` is in. Days before `start`, after `end`, or after `today` are `outside`.
 * `counts` gives each day's count; days missing from it count 0.
 */
export function activityWeeks(
  start: string,
  end: string,
  today: string,
  counts: ReadonlyMap<string, number>,
): ActivityCell[][] {
  const first = parse(start);
  const last = parse(end);
  const now = parse(today);
  const monday = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY;
  const weeks = Math.floor((last - monday) / (7 * DAY)) + 1;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const time = monday + (w * 7 + d) * DAY;
      const date = format(time);
      if (time < first || time > last || time > now) {
        return { date, count: 0, level: 0, outside: true } as const;
      }
      const count = counts.get(date) ?? 0;
      return { date, count, level: activityLevel(count) };
    }),
  );
}

/**
 * Month names over the grid, each at the week holding its 1st, for the months in the
 * span (`start` to `end`). The partial month the past year starts in has no 1st on it,
 * so it goes unlabelled, as on GitHub.
 */
export function monthLabels(
  weeks: readonly ActivityCell[][],
  start: string,
  end: string,
): { column: number; label: string }[] {
  return weeks.flatMap((week, column) => {
    const first = week.find(
      (cell) => cell.date.endsWith("-01") && cell.date >= start && cell.date <= end,
    );
    return first ? [{ column, label: MONTHS[Number(first.date.slice(5, 7)) - 1] }] : [];
  });
}

/** A day as the grid's tooltip writes it: "8 November 2026". */
export function formatDay(date: string): string {
  return new Date(parse(date)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
