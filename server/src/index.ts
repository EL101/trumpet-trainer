import "dotenv/config";
import "./firebase.js";
import express, { Request, Response } from "express";
import cors from "cors";
import historyRouter from "./routes/history.js";
import libraryRouter from "./routes/library.js";
import profileRouter from "./routes/profile.js";
import { startGuestSweep } from "./guestSweep.js";
import { AVATAR_BODY_LIMIT } from "./avatar.js";

const app = express();
app.use(cors());
// An avatar upload is a base64 image, well past express.json()'s 100kb default.
// Mounted first: body-parser marks the request parsed, so the global parser
// below skips it rather than re-reading it at the smaller limit.
app.use("/api/profile/avatar", express.json({ limit: AVATAR_BODY_LIMIT }));
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/", (_req: Request, res: Response) => {
  res.send("hello");
});

app.use("/api/history", historyRouter);
app.use("/api/library", libraryRouter);
app.use("/api/profile", profileRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
  startGuestSweep();
});
