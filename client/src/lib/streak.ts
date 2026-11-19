/** How a day of the sidebar's streak week is drawn. */
export type StreakDayState = "done" | "today" | "missed" | "upcoming";

/**
 * One day of this week, for the sidebar: played (`done`); `today`, not played yet;
 * gone by without play (`missed`); or still to come (`upcoming`).
 */
export type StreakDay = { label: string; name: string; state: StreakDayState };

const DAY = 24 * 60 * 60 * 1000;
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** This week, Monday to Sunday, around `today`, given the days played (YYYY-MM-DD). */
export function streakWeek(today: string, played: readonly string[]): StreakDay[] {
  const now = Date.parse(`${today}T00:00:00Z`);
  const monday = now - ((new Date(now).getUTCDay() + 6) % 7) * DAY;
  const days = new Set(played);
  return NAMES.map((name, i) => {
    const time = monday + i * DAY;
    const date = new Date(time).toISOString().slice(0, 10);
    const state: StreakDayState = days.has(date)
      ? "done"
      : time === now
        ? "today"
        : time < now
          ? "missed"
          : "upcoming";
    return { label: name[0], name, state };
  });
}

/** The week in words, for screen readers: "Played on Monday and Tuesday this week". */
export function describeWeek(week: readonly StreakDay[]): string {
  const played = week.filter((day) => day.state === "done").map((day) => day.name);
  if (played.length === 0) return "Nothing played yet this week";
  const list =
    played.length === 1 ? played[0] : `${played.slice(0, -1).join(", ")} and ${played.at(-1)}`;
  return `Played on ${list} this week`;
}
