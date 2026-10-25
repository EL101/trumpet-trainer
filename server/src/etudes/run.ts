import type Anthropic from "@anthropic-ai/sdk";
import { ExerciseType } from "../generated/prisma/enums.js";
import { finishEtude } from "../queries/etudes.js";
import { insertHistory } from "../queries/exercises.js";
import { costMicros, ETUDE_MODEL } from "./claude.js";
import { EtudeFailure, writeEtude, type TokenUsage } from "./generate.js";
import { etudeNotes, type EtudeOptions } from "./music.js";

/** What the player is told when an etude can't be written, by why. */
const FAILURE_MESSAGES: Record<EtudeFailure["kind"], string> = {
  unavailable: "The etude writer can't be reached right now. Try again in a minute.",
  bad_output: "Couldn't write a usable etude this time. Try again.",
  unexpected: "Something went wrong writing the etude. Try again.",
};

/** Etudes being written in this process, by id. Each leaves once it's settled. */
const running = new Map<string, Promise<void>>();

/** Whether this process takes new etudes. Shutdown turns it off. */
let accepting = true;

/** Stop (or, in tests, resume) taking new etudes. POST /api/etudes refuses while off. */
export function acceptEtudes(accept: boolean): void {
  accepting = accept;
}

export const acceptingEtudes = () => accepting;

/** Resolves once every etude being written now has finished. For tests and shutdown. */
export function etudesSettled(): Promise<unknown> {
  return Promise.all(running.values());
}

/** The etudes this process is still writing, for shutdown to mark as interrupted. */
export function runningEtudeIds(): string[] {
  return [...running.keys()];
}

/**
 * Write a reserved etude in the background and save it to the user's history.
 * The request that asked for it returns straight away, so the etude is finished
 * and saved however the player leaves the page; they pick it up from history or
 * by asking after it. Never throws: every outcome is recorded on the request.
 */
export function startEtude(
  client: Anthropic,
  id: string,
  userId: string,
  options: EtudeOptions,
): void {
  const job = runEtude(client, id, userId, options).finally(() => running.delete(id));
  running.set(id, job);
}

async function runEtude(client: Anthropic, id: string, userId: string, options: EtudeOptions) {
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const spent = () => ({
    ...usage,
    costMicros: costMicros(ETUDE_MODEL, usage.inputTokens, usage.outputTokens),
  });

  try {
    const written = await writeEtude(client, options);
    usage = written.usage;
    const { row } = await insertHistory(userId, {
      exerciseType: ExerciseType.ETUDES,
      notes: etudeNotes(written.bars),
      timeSig: options.timeSig,
      musicKey: options.musicKey,
      noteRange: options.noteRange,
      difficulty: options.difficulty,
    });
    await finishEtude(
      id,
      { status: "SUCCEEDED", exerciseId: row.exerciseId, error: null },
      spent(),
    );
  } catch (err) {
    if (err instanceof EtudeFailure) usage = err.usage;
    console.error(`Failed to write etude ${id}:`, err);
    const kind = err instanceof EtudeFailure ? err.kind : "unexpected";
    try {
      await finishEtude(id, { status: "FAILED", error: FAILURE_MESSAGES[kind] }, spent());
    } catch (recordErr) {
      // Left pending, it's marked failed once it's stale, so the user isn't stuck.
      console.error(`Failed to record etude ${id} as failed:`, recordErr);
    }
  }
}
