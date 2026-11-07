import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { ClearHistorySchema, HistoryInputSchema } from "../schema/index.js";
import { clearHistory, findExercise, insertHistory, listExercises } from "../queries/exercises.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listExercises("history", req.user!.uid));
  } catch (err) {
    console.error("Failed to load history:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

router.get("/:exerciseId", requireAuth, async (req: Request, res: Response) => {
  // Exercise ids are uuids. Anything else can't be one of the user's, and would make
  // Postgres reject the query, so it's not found rather than an error.
  const exerciseId = z.uuid().safeParse(req.params.exerciseId);
  if (!exerciseId.success) {
    return res.status(404).json({ error: "History entry not found" });
  }

  try {
    const row = await findExercise("history", req.user!.uid, exerciseId.data);
    if (!row) return res.status(404).json({ error: "History entry not found" });
    res.json(row);
  } catch (err) {
    console.error("Failed to load history entry:", err);
    res.status(500).json({ error: "Failed to load history entry" });
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
  // No body (clients built before `keep`) clears everything.
  const parsed = ClearHistorySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const kept = await clearHistory(req.user!.uid, parsed.data.keep);
    if (kept) return res.json(kept);
    res.status(204).end();
  } catch (err) {
    console.error("Failed to clear history:", err);
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
