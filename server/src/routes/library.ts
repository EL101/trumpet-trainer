import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { ExerciseType } from "../generated/prisma/enums.js";
import { ExerciseInputSchema } from "../schema/index.js";
import {
  deleteLibraryEntry,
  findExercise,
  insertLibrary,
  listExercises,
} from "../queries/exercises.js";
import { listLibraryPage } from "../queries/library.js";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listExercises("library", req.user!.uid));
  } catch (err) {
    console.error("Failed to load library:", err);
    res.status(500).json({ error: "Failed to load library" });
  }
});

/** GET /api/library/page: which entries to send. */
const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  after: z.uuid().optional(),
  type: z.enum(ExerciseType).optional(),
  q: z.string().max(200).default(""),
});

// The library a page at a time, filtered by type and searched, for browsing it. GET /
// still sends every entry, for callers that need them all at once.
router.get("/page", requireAuth, async (req: Request, res: Response) => {
  const parsed = PageQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  const { limit, after, type, q } = parsed.data;
  try {
    const page = await listLibraryPage(req.user!.uid, { limit, after, type, query: q });
    // The entry to follow on from has gone, so the caller has to say where it is now.
    if (!page) return res.status(404).json({ error: "Library entry not found" });
    res.json(page);
  } catch (err) {
    console.error("Failed to load library page:", err);
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
