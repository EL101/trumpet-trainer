import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { ExerciseInputSchema } from "../schema/index.js";
import {
  deleteLibraryEntry,
  findExercise,
  insertLibrary,
  listExercises,
} from "../queries/exercises.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listExercises("library", req.user!.uid));
  } catch (err) {
    console.error("Failed to load library:", err);
    res.status(500).json({ error: "Failed to load library" });
  }
});

router.get("/:exerciseId", requireAuth, async (req: Request, res: Response) => {
  // Exercise ids are uuids. Anything else can't be one of the user's, and would make
  // Postgres reject the query, so it's not found rather than an error.
  const exerciseId = z.uuid().safeParse(req.params.exerciseId);
  if (!exerciseId.success) {
    return res.status(404).json({ error: "Library entry not found" });
  }

  try {
    const row = await findExercise("library", req.user!.uid, exerciseId.data);
    if (!row) return res.status(404).json({ error: "Library entry not found" });
    res.json(row);
  } catch (err) {
    console.error("Failed to load library entry:", err);
    res.status(500).json({ error: "Failed to load library entry" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = ExerciseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    // Saving an exercise that's already in the library is a no-op, answered with 200.
    const { row, created } = await insertLibrary(req.user!.uid, parsed.data);
    res.status(created ? 201 : 200).json(row);
  } catch (err) {
    console.error("Failed to insert library row:", err);
    res.status(500).json({ error: "Failed to save library entry" });
  }
});

router.delete("/:exerciseId", requireAuth, async (req: Request, res: Response) => {
  // As for GET: an id that isn't a uuid can't be one of the user's.
  const exerciseId = z.uuid().safeParse(req.params.exerciseId);
  if (!exerciseId.success) {
    return res.status(404).json({ error: "Library entry not found" });
  }

  try {
    const deleted = await deleteLibraryEntry(req.user!.uid, exerciseId.data);
    if (!deleted) return res.status(404).json({ error: "Library entry not found" });
    res.status(204).end();
  } catch (err) {
    console.error("Failed to delete library entry:", err);
    res.status(500).json({ error: "Failed to delete library entry" });
  }
});

export default router;
