import type { EtudeJob } from "@/utils/etudes";
import { formatPitch } from "./format";
import { DIFFICULTY_LABELS } from "./generatorOptions";

/** What the corner notice says about an etude that has finished. */
export type EtudeNotice = {
  tone: "success" | "error" | "info";
  title: string;
  description: string;
};

const FALLBACK_ERROR = "Something went wrong writing the etude. Try again.";

/**
 * The notice for an etude that has finished: ready, failed with the server's reason,
 * or written but gone because history was cleared before it arrived.
 */
export function etudeNotice(job: EtudeJob): EtudeNotice {
  if (job.status === "FAILED") {
    return {
      tone: "error",
      title: "Couldn't write your etude",
      description: job.error ?? FALLBACK_ERROR,
    };
  }
  const exercise = job.exercise;
  if (!exercise) {
    return {
      tone: "info",
      title: "Your etude was cleared",
      description:
        "History was cleared before your etude arrived, so it wasn't kept. It still counts towards today's etudes.",
    };
  }
  return {
    tone: "success",
    title: "Your etude is ready",
    description: `${formatPitch(exercise.musicKey)} · ${exercise.timeSig} · ${DIFFICULTY_LABELS[exercise.difficulty]} difficulty`,
  };
}
