import { HISTORY_LIMIT, pruneHistory } from "./queries/exercises.js";

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

/** Delay before the first prune: past startup, and a minute after the guest sweep's. */
const INITIAL_DELAY_MS = 2 * 60 * 1000;

async function runOnce() {
  try {
    const deleted = await pruneHistory();
    if (deleted > 0) {
      console.log(
        `History prune: deleted ${deleted} row(s) past each user's newest ${HISTORY_LIMIT}`,
      );
    }
  } catch (err) {
    // Never let a prune failure take the process down; the next tick retries.
    console.error("History prune failed:", err);
  }
}

/**
 * Periodically delete history rows past each user's newest HISTORY_LIMIT.
 *
 * GET /api/history only ever returns those newest rows, so the extra rows that
 * build up between runs are already invisible; this just reclaims their space.
 * Running several instances is safe: the deletes are idempotent.
 */
export function startHistoryPrune() {
  if (process.env.HISTORY_PRUNE_ENABLED === "false") {
    console.log("History prune disabled");
    return;
  }

  console.log(
    `History prune every ${PRUNE_INTERVAL_MS / 60000}m, keeping ${HISTORY_LIMIT} per user`,
  );
  setTimeout(runOnce, INITIAL_DELAY_MS).unref();
  setInterval(runOnce, PRUNE_INTERVAL_MS).unref();
}
