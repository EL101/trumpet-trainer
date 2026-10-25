import type { Server } from "node:http";
import { acceptEtudes, etudesSettled, runningEtudeIds } from "./etudes/run.js";
import { failInterruptedEtudes } from "./queries/etudes.js";

/**
 * Stop for a deploy or restart without leaving players waiting on etudes that
 * will never come. Stops taking new connections and new etudes, then gives the
 * etudes being written until `graceMs` to finish. Any still running after that
 * are marked failed, so their players hear now rather than at the stale cutoff.
 * Only this process's etudes are marked: other instances may be writing theirs.
 *
 * It doesn't wait for connections to close: a proxy or a polling browser keeps a
 * keep-alive connection open, which would hold it to the full grace period. Once
 * the etudes are settled, every connection left is closed.
 *
 * Doesn't exit; the caller does once this resolves.
 */
export async function shutdown(server: Server, graceMs: number): Promise<void> {
  acceptEtudes(false);
  server.close();
  console.log(
    `Shutting down: giving ${runningEtudeIds().length} etudes being written up to ${graceMs} ms`,
  );

  let timer: NodeJS.Timeout | undefined;
  let graceOver = false;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      graceOver = true;
      resolve();
    }, graceMs);
  });
  // Again while any are left, so an etude that starts during the wait (its request
  // was already past the check when etudes stopped being taken) is waited for too.
  while (!graceOver && runningEtudeIds().length > 0) {
    await Promise.race([etudesSettled(), deadline]);
  }
  clearTimeout(timer);

  const cutOff = runningEtudeIds();
  if (cutOff.length === 0) {
    console.log("Shutting down: no etudes left being written");
  } else {
    const { count } = await failInterruptedEtudes(cutOff);
    console.log(
      `Shutting down: marked ${count} of ${cutOff.length} unfinished etudes as interrupted`,
    );
  }
  server.closeAllConnections();
}
