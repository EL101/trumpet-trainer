import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/users/:id", (req: Request, res: Response) => {
  res.json({
    uid: req.user!.uid,
    name: req.user!.name,
    email: req.user!.email,
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.send("hello");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
