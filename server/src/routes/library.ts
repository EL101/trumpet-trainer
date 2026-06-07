import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { pool } from "../db.js";
import { z } from "zod";
import camelcaseKeys from "camelcase-keys";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, notes, time_sig, music_key, note_range AS range, difficulty, generation_num
      FROM library
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [req.user!.uid],
  );
  res.json(camelcaseKeys(rows, { deep: true }));
});

const UpdateLibrarySchema = z.object({
  notes: z.string().min(1),
  timeSig: z.string(),
  musicKey: z.string(),
  noteRange: z.string(),
  difficulty: z.string(),
  generationNum: z.number().int().positive(),
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = UpdateLibrarySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  const { notes, timeSig, musicKey, noteRange, difficulty, generationNum } = parsed.data;
  try {
    const { rows } = await pool.query(
      `INSERT INTO library (id, user_id, notes, time_sig, music_key, note_range, difficulty, generation_num)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, notes, time_sig, music_key, note_range, difficulty, generation_num, created_at`,
      [
        crypto.randomUUID(),
        req.user!.uid,
        notes,
        timeSig,
        musicKey,
        noteRange,
        difficulty,
        generationNum,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Failed to insert library row:", err);
    res.status(500).json({ error: "Failed to save library entry" });
  }
});

export default router;
