import type { Server } from "node:http";
import { etudesSettled, runningEtudeIds } from "./etudes/run.js";
import { failInterruptedEtudes } from "./queries/etudes.js";

/**
 * Stop for a deploy or restart without leaving players waiting on etudes that
 * will never come. Stops taking connections and lets requests already in flight
 * finish, so no new etude can start, then gives the etudes being written until
 * `graceMs` (from the start) to finish. Any still running after that are marked
 * failed, so their players hear now rather than at the stale cutoff. Only this
 * process's etudes are marked: other instances may be writing theirs.
 *
 * Doesn't exit; the caller does once this resolves.
 */
export async function shutdown(server: Server, graceMs: number): Promise<void> {
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  console.log(
    `Shutting down: giving ${runningEtudeIds().length} etudes being written up to ${graceMs} ms`,
  );

  let timer: NodeJS.Timeout | undefined;
  const graceOver = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  await Promise.race([closed.then(() => etudesSettled()), graceOver]);
  clearTimeout(timer);

  const cutOff = runningEtudeIds();
  if (cutOff.length === 0) {
    console.log("Shutting down: no etudes left being written");
    return;
  }
  const { count } = await failInterruptedEtudes(cutOff);
  console.log(
    `Shutting down: marked ${count} of ${cutOff.length} unfinished etudes as interrupted`,
  );
}
