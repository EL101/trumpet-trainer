import "dotenv/config";
import "./firebase.js";
import { app } from "./app.js";
import { startGuestSweep } from "./guestSweep.js";

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
  startGuestSweep();
});
