import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { ExerciseInputSchema } from "../schema/index.js";
import { insertExercise, listExercises } from "../queries/exercises.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listExercises("library", req.user!.uid));
  } catch (err) {
    console.error("Failed to load library:", err);
    res.status(500).json({ error: "Failed to load library" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = ExerciseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const row = await insertExercise("library", req.user!.uid, parsed.data);
    res.status(201).json(row);
  } catch (err) {
    console.error("Failed to insert library row:", err);
    res.status(500).json({ error: "Failed to save library entry" });
  }
});

export default router;
