import type { User } from "firebase/auth";
import type { RunScore, ScoreNote, ScorePart } from "@/lib/scoring";
import { ApiError, authedFetch } from "./api";

/** A scored run as the server keeps it: its scores, the tempo, and when it was played. */
export type SavedScore = RunScore & {
  exerciseId: string;
  tempo: number;
  /** ISO date-time. */
  createdAt: string;
};

/** A practice_scores row, as the API sends it. Mirrors the server's ScoreInputSchema. */
type ScoreRow = {
  exerciseId: string;
  tempo: number;
  overall: number;
  createdAt: string;
} & { [P in ScorePart as `${P}Score`]: number } & {
  [P in ScorePart as `${P}Feedback`]: ScoreNote[];
};

const PARTS: readonly ScorePart[] = ["rightNotes", "rhythm", "intonation", "tone"];

function fromRow(row: ScoreRow): SavedScore {
  const parts = Object.fromEntries(
    PARTS.map((part) => [part, { score: row[`${part}Score`], notes: row[`${part}Feedback`] }]),
  ) as RunScore["parts"];
  const { exerciseId, tempo, overall, createdAt } = row;
  return { exerciseId, tempo, overall, createdAt, parts };
}

/** Saves a scored run. Resolves to it as saved, or null without a signed-in user; throws if it couldn't be. */
export async function saveScore(
  exerciseId: string,
  tempo: number,
  score: RunScore,
  user: User | undefined | null,
): Promise<SavedScore | null> {
  const body = {
    exerciseId,
    tempo,
    overall: score.overall,
    ...Object.fromEntries(
      PARTS.flatMap((part) => [
        [`${part}Score`, score.parts[part].score],
        [`${part}Feedback`, score.parts[part].notes],
      ]),
    ),
  };
  const res = await authedFetch("/api/scores", user, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res ? fromRow(await res.json()) : null;
}

/**
 * The newest scored run of an exercise. Resolves to null if it's never been scored (or
 * there's no signed-in user); throws if it couldn't be asked.
 */
export async function getLatestScore(
  exerciseId: string,
  user: User | undefined | null,
  signal?: AbortSignal,
): Promise<SavedScore | null> {
  try {
    const res = await authedFetch(`/api/scores/latest/${encodeURIComponent(exerciseId)}`, user, {
      signal,
    });
    return res ? fromRow(await res.json()) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
