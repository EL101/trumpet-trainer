import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { pool } from "../db.js";
import { z } from "zod";
import camelcaseKeys from "camelcase-keys";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT id, notes, time_sig, music_key, note_range AS range, difficulty, generation_num
      FROM history
      WHERE user_id = $1
      ORDER BY generation_num DESC`,
    [req.user!.uid],
  );
  res.json(camelcaseKeys(rows, { deep: true }));
});

const UpdateHistorySchema = z.object({
  notes: z.string().min(1),
  timeSig: z.string(),
  musicKey: z.string(),
  noteRange: z.string(),
  difficulty: z.string(),
  generationNum: z.number().int().positive(),
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = UpdateHistorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  const { notes, timeSig, musicKey, noteRange, difficulty, generationNum } = parsed.data;
  try {
    const { rows } = await pool.query(
      `INSERT INTO history (id, user_id, notes, time_sig, music_key, note_range, difficulty, generation_num)
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
    console.error("Failed to insert history row:", err);
    res.status(500).json({ error: "Failed to save history entry" });
  }
});

router.delete("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`TRUNCATE TABLE history`);
    res.status(201).json(camelcaseKeys(rows, { deep: true }));
  } catch (err) {
    console.error("Failed to clear history:", err);
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
