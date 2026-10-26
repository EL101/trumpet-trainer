import type { MusicInfo } from "@/schema";

/** The player's route. */
export const PRACTICE_PATH = "/practice";

/** The page the player was opened from: where its back links go, and what they call it. */
export type PracticeOrigin = { to: string; label: string };

/** What a link to the player carries in its router state. */
export type PracticeState = { exercise: MusicInfo; from: PracticeOrigin };

/** What the player hands back to the page it was opened from. */
export type PracticedState = { practiced: MusicInfo };

/** The back link's label for a page the nav doesn't name. */
const FALLBACK_LABEL = "Back";

/** Where a player opened from `pathname` goes back to, named as the nav names it. */
export function originFor(
  pathname: string,
  navItems: readonly { to: string; label: string }[],
): PracticeOrigin {
  const item = navItems.find((i) => i.to === pathname);
  return { to: pathname, label: item?.label ?? FALLBACK_LABEL };
}

/** "Back to Generate", or just "Back" for a page without a name. */
export function backTo(origin: PracticeOrigin) {
  return origin.label === FALLBACK_LABEL ? FALLBACK_LABEL : `Back to ${origin.label}`;
}

/** The player's state from `location.state`, or null without one (the URL typed in). */
export function readPracticeState(state: unknown): PracticeState | null {
  if (!isRecord(state) || !isExercise(state.exercise) || !isRecord(state.from)) return null;
  const { to, label } = state.from;
  if (typeof to !== "string" || typeof label !== "string") return null;
  return { exercise: state.exercise, from: { to, label } };
}

/** The exercise the player handed back, from `location.state`, if it did. */
export function readPracticed(state: unknown): MusicInfo | null {
  return isRecord(state) && isExercise(state.practiced) ? state.practiced : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Enough of an exercise to draw and play. Router state outlives a deploy, so check. */
function isExercise(value: unknown): value is MusicInfo {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.exerciseType === "string" &&
    typeof value.notes === "string" &&
    typeof value.timeSig === "string" &&
    typeof value.musicKey === "string"
  );
}
