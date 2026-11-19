import { describe, expect, it } from "vitest";
import { describeWeek, streakWeek } from "./streak";

const states = (today: string, played: string[]) =>
  streakWeek(today, played).map((day) => day.state);

describe("streakWeek", () => {
  // Thursday 5 November 2026.
  const thursday = "2026-11-05";

  it("runs Monday to Sunday, the week today is in", () => {
    const week = streakWeek(thursday, []);
    expect(week.map((day) => day.label).join("")).toBe("MTWTFSS");
    expect(week[0].name).toBe("Monday");
  });

  it("marks the days played, today, the days missed and the days to come", () => {
    expect(states(thursday, ["2026-11-02", "2026-11-04"])).toEqual([
      "done",
      "missed",
      "done",
      "today",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("marks today played once it is", () => {
    expect(states(thursday, ["2026-11-05"])[3]).toBe("done");
  });

  it("ignores days played in other weeks", () => {
    expect(states(thursday, ["2026-11-01", "2026-11-09"])).not.toContain("done");
  });

  it("puts a Monday first and a Sunday last", () => {
    expect(states("2026-11-02", [])[0]).toBe("today");
    expect(states("2026-11-08", [])).toEqual([...Array(6).fill("missed"), "today"]);
  });
});

describe("describeWeek", () => {
  const week = (played: string[]) => streakWeek("2026-11-05", played);

  it("names the days played", () => {
    expect(describeWeek(week(["2026-11-02"]))).toBe("Played on Monday this week");
    expect(describeWeek(week(["2026-11-02", "2026-11-03", "2026-11-05"]))).toBe(
      "Played on Monday, Tuesday and Thursday this week",
    );
  });

  it("says when nothing's been played", () => {
    expect(describeWeek(week([]))).toBe("Nothing played yet this week");
  });
});
