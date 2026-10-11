import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { HistoryInputSchema } from "../schema/index.js";
import { deleteExercises, insertHistory, listExercises } from "../queries/exercises.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listExercises("history", req.user!.uid));
  } catch (err) {
    console.error("Failed to load history:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = HistoryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    // The row comes back with the number it was given. An older client's repeat
    // of a number it already saved is a no-op, answered with 200.
    const { row, created } = await insertHistory(req.user!.uid, parsed.data);
    res.status(created ? 201 : 200).json(row);
  } catch (err) {
    console.error("Failed to insert history row:", err);
    res.status(500).json({ error: "Failed to save history entry" });
  }
});

router.delete("/", requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteExercises("history", req.user!.uid);
    res.status(204).end();
  } catch (err) {
    console.error("Failed to clear history:", err);
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
