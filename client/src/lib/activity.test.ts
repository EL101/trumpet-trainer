import { describe, expect, it } from "vitest";
import {
  activityLevel,
  activityWeeks,
  calendarYear,
  formatDay,
  localToday,
  monthLabels,
  pastYear,
  type ActivityCell,
} from "./activity";

describe("activityLevel", () => {
  it("darkens in fixed steps", () => {
    expect([0, 1, 2, 3, 4, 6, 7, 40].map(activityLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("activityWeeks", () => {
  // 8 November 2026 is a Sunday; 4 November a Wednesday.
  const shown = (cells: ActivityCell[]) => cells.filter((c) => !c.outside).map((c) => c.date);

  it("shows the past year as 53 weeks, Monday first, up to today", () => {
    const [start, end] = pastYear("2026-11-04");
    expect(start).toBe("2025-11-03");
    const weeks = activityWeeks(start, end, "2026-11-04", new Map());
    expect(weeks).toHaveLength(53);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe("2025-11-03");
    expect(shown(weeks.at(-1)!)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(weeks.at(-1)![6]).toEqual({ date: "2026-11-08", count: 0, level: 0, outside: true });
  });

  it("starts a calendar year on its own weekday and ends it on 31 December", () => {
    // 1 January 2025 is a Wednesday, 31 December a Wednesday too.
    const [start, end] = calendarYear(2025);
    const weeks = activityWeeks(start, end, "2026-11-08", new Map());
    expect(weeks).toHaveLength(53);
    expect(weeks[0].map((c) => c.date)).toEqual([
      "2024-12-30",
      "2024-12-31",
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
    ]);
    expect(shown(weeks[0])).toEqual(weeks[0].slice(2).map((c) => c.date));
    expect(shown(weeks.at(-1)!)).toEqual(["2025-12-29", "2025-12-30", "2025-12-31"]);
    expect(weeks.flat().filter((c) => !c.outside)).toHaveLength(365);
  });

  it("hides the days of this year still to come", () => {
    const [start, end] = calendarYear(2026);
    const days = activityWeeks(start, end, "2026-11-08", new Map()).flat();
    expect(days.filter((c) => !c.outside).at(-1)!.date).toBe("2026-11-08");
  });

  it("puts each day's count and shade on it", () => {
    const counts = new Map([
      ["2026-11-03", 5],
      ["2026-11-04", 1],
    ]);
    const [start, end] = pastYear("2026-11-04");
    const last = activityWeeks(start, end, "2026-11-04", counts).at(-1)!;
    expect(last.slice(0, 3)).toEqual([
      { date: "2026-11-02", count: 0, level: 0 },
      { date: "2026-11-03", count: 5, level: 3 },
      { date: "2026-11-04", count: 1, level: 1 },
    ]);
  });

  it("keeps every day across a clock change", () => {
    const days = activityWeeks("2026-10-26", "2026-11-08", "2026-11-08", new Map()).flat();
    expect(days).toHaveLength(14);
    expect(new Set(days.map((c) => c.date)).size).toBe(14);
    expect(days.map((c) => c.date)).toContain("2026-11-01");
  });
});

describe("monthLabels", () => {
  it("labels the week each month starts in, not the past year's partial first month", () => {
    const [start, end] = pastYear("2026-11-04");
    const labels = monthLabels(activityWeeks(start, end, "2026-11-04", new Map()), start, end);
    expect(labels[0]).toEqual({ column: 4, label: "Dec" });
    expect(labels.at(-1)).toEqual({ column: 51, label: "Nov" });
    expect(labels).toHaveLength(12);
  });

  it("labels all twelve months of a year, even those still to come", () => {
    const [start, end] = calendarYear(2026);
    const labels = monthLabels(activityWeeks(start, end, "2026-03-10", new Map()), start, end);
    expect(labels.map((l) => l.label)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(labels[0].column).toBe(0);
  });
});

describe("localToday", () => {
  it("writes the local date", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("formatDay", () => {
  it("writes the day in full, whatever the time zone", () => {
    expect(formatDay("2026-11-01")).toBe("1 November 2026");
  });
});
