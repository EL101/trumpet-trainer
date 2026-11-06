import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { ScoreInputSchema } from "../schema/index.js";
import { findExercise, insertScore, latestScore } from "../queries/scores.js";

const router = Router();

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = ScoreInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  const uid = req.user!.uid;
  try {
    // Only the user's own exercises get scores, and each keeps what its exercise was
    // (from the server's own row, not the request) for when the exercise is gone.
    const exercise = await findExercise(uid, parsed.data.exerciseId);
    if (!exercise) {
      return res.status(404).json({ error: "Exercise not found" });
    }
    res.status(201).json(await insertScore(uid, exercise, parsed.data));
  } catch (err) {
    console.error("Failed to save score:", err);
    res.status(500).json({ error: "Failed to save score" });
  }
});

router.get("/latest/:exerciseId", requireAuth, async (req: Request, res: Response) => {
  // As for history: an id that isn't a uuid can't be one of the user's exercises.
  const exerciseId = z.uuid().safeParse(req.params.exerciseId);
  if (!exerciseId.success) {
    return res.status(404).json({ error: "No score for this exercise" });
  }

  try {
    const row = await latestScore(req.user!.uid, exerciseId.data);
    if (!row) return res.status(404).json({ error: "No score for this exercise" });
    res.json(row);
  } catch (err) {
    console.error("Failed to load score:", err);
    res.status(500).json({ error: "Failed to load score" });
  }
});

export default router;
