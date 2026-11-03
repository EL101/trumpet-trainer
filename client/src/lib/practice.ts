import { isMusicInfo, type MusicInfo } from "@/schema";

/** The player's route. The exercise's id follows it: `/practice/<exerciseId>`. */
export const PRACTICE_PATH = "/practice";

/** The page the player goes back to when nothing says where it was opened from. */
export const DEFAULT_ORIGIN = "/generate";

/**
 * The player's address for an exercise. It names the page it was opened from too, so
 * a player opened in a new tab (no router state) still knows where to go back to.
 */
export function practicePath(exerciseId: string, from: string) {
  const query = new URLSearchParams({ from });
  return `${PRACTICE_PATH}/${encodeURIComponent(exerciseId)}?${query}`;
}

/** Stands in for this app's origin while a `from` is read, so the check stays pure. */
const OWN_ORIGIN = "https://app.invalid";

/**
 * The page to go back to, from a player address's `from`, if it names a page of this
 * app. Anything else (missing, another site, `//host`) goes back to DEFAULT_ORIGIN.
 *
 * It's read the way a browser reads a link, which drops tabs and newlines and takes `\`
 * for `/`, so `/\n/host` (read as `//host`) is turned down too. What comes back is the
 * path as read, so the link can't be read any other way.
 */
export function returnPath(from: string | null) {
  if (!from?.startsWith("/")) return DEFAULT_ORIGIN;
  const url = new URL(from, OWN_ORIGIN);
  return url.origin === OWN_ORIGIN ? url.pathname + url.search + url.hash : DEFAULT_ORIGIN;
}

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

/** The player's state from `location.state`, or null without one (a new tab, or typed in). */
export function readPracticeState(state: unknown): PracticeState | null {
  if (!isRecord(state) || !isMusicInfo(state.exercise) || !isRecord(state.from)) return null;
  const { to, label } = state.from;
  if (typeof to !== "string" || typeof label !== "string") return null;
  return { exercise: state.exercise, from: { to, label } };
}

/** The exercise the player handed back, from `location.state`, if it did. */
export function readPracticed(state: unknown): MusicInfo | null {
  return isRecord(state) && isMusicInfo(state.practiced) ? state.practiced : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
