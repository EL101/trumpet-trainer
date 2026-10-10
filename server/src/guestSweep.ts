import { GUEST_TTL_MS, sweepAbandonedGuests } from "./queries/users.js";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** Delay before the first sweep, so a boot isn't competing with startup work. */
const INITIAL_DELAY_MS = 60 * 1000;

async function runOnce() {
  try {
    const { deleted, scanned } = await sweepAbandonedGuests();
    if (deleted > 0) {
      console.log(`Guest sweep: deleted ${deleted} abandoned guest(s) of ${scanned} scanned`);
    }
  } catch (err) {
    // Never let a sweep failure take the process down; the next tick retries.
    console.error("Guest sweep failed:", err);
  }
}

/**
 * Periodically delete guests idle for longer than the TTL.
 *
 * Running several instances is safe: the deletes are idempotent, and whichever
 * sweep loses a race simply finds nothing to do.
 */
export function startGuestSweep() {
  if (process.env.GUEST_SWEEP_ENABLED === "false") {
    console.log("Guest sweep disabled");
    return;
  }

  console.log(`Guest sweep every ${SWEEP_INTERVAL_MS / 60000}m, TTL ${GUEST_TTL_MS / 3600000}h`);
  setTimeout(runOnce, INITIAL_DELAY_MS).unref();
  setInterval(runOnce, SWEEP_INTERVAL_MS).unref();
}
