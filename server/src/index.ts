import "dotenv/config";
import "./firebase.js";
import express, { Request, Response } from "express";
import cors from "cors";
import historyRouter from "./routes/history.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/", (_req: Request, res: Response) => {
  res.send("hello");
});

app.use("/api/history", historyRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
