import "dotenv/config";
import "./firebase.js";
import { app } from "./app.js";
import { envNumber } from "./env.js";
import { startGuestSweep } from "./guestSweep.js";
import { startHistoryPrune } from "./historyPrune.js";
import { shutdown } from "./shutdown.js";

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
  startGuestSweep();
  startHistoryPrune();
});

// Deploys stop the process with SIGTERM, and Ctrl-C sends SIGINT. The grace period
// has to stay well under the platform's wait before it kills the process.
let stopping = false;
function stop(signal: NodeJS.Signals) {
  if (stopping) {
    console.log(`${signal} received again: already shutting down`);
    return;
  }
  stopping = true;
  console.log(`${signal} received`);
  shutdown(server, envNumber("ETUDE_SHUTDOWN_GRACE_MS", 20_000)).then(
    () => process.exit(0),
    (err) => {
      console.error("Shutdown failed:", err);
      process.exit(1);
    },
  );
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
