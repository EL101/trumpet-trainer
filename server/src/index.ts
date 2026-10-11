import "dotenv/config";
import "./firebase.js";
import { app } from "./app.js";
import { startGuestSweep } from "./guestSweep.js";
import { startHistoryPrune } from "./historyPrune.js";

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
  startGuestSweep();
  startHistoryPrune();
});
