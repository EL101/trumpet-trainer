import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { SettingsSchema } from "../schema/index.js";
import { getSettings, saveSettings } from "../queries/settings.js";

const router = Router();

/** The caller's settings, or the defaults if they've never saved any. */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await getSettings(req.user!.uid));
  } catch (err) {
    console.error("Failed to load settings:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

/** Replace the caller's settings, answering with what was saved. */
router.put("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    res.json(await saveSettings(req.user!.uid, parsed.data));
  } catch (err) {
    console.error("Failed to save settings:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
