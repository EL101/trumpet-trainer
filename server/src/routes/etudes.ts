import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { EtudeRequestSchema } from "../schema/index.js";
import { z } from "zod";
import { anthropic, costMicros, ETUDE_MODEL } from "../etudes/claude.js";
import { MAX_USAGE } from "../etudes/generate.js";
import { acceptingEtudes, startEtude } from "../etudes/run.js";
import { envNumber } from "../env.js";
import {
  etudeQuota,
  failStaleEtudes,
  findEtude,
  pendingEtude,
  reserveEtude,
  spendTodayMicros,
} from "../queries/etudes.js";

const router = Router();

/** Etudes a user can generate in 24 hours. */
const dailyLimit = () => envNumber("ETUDE_DAILY_LIMIT", 10);

/**
 * Etudes are for signed-in users only. Anyone can make a new guest account, so a
 * guest quota would be no limit at all on what we spend.
 */
function refuseGuests(req: Request, res: Response, next: NextFunction) {
  if (req.user!.firebase?.sign_in_provider !== "anonymous") return next();
  res.status(403).json({
    error: "Etudes need an account. Sign in with Google from Profile and settings.",
  });
}

/** Spend across all users, per UTC day, after which etudes pause until midnight. */
const dailySpendCapMicros = () => envNumber("ETUDE_DAILY_SPEND_USD", 5) * 1_000_000;

/**
 * What an etude is booked at against the cap until it's written: the most it can
 * cost. Its real cost replaces this once it's done, so etudes being written count
 * towards the cap, and one cut off by a restart is never counted as free.
 */
const bookedCostMicros = costMicros(ETUDE_MODEL, MAX_USAGE.inputTokens, MAX_USAGE.outputTokens);

/**
 * The user's quota, and the etude they're waiting for if there is one, so a page
 * that was reloaded or left mid-etude can pick it up again. `enabled` says whether
 * this server can write etudes at all, so the page can say so before anyone asks.
 */
router.get("/quota", requireAuth, refuseGuests, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    await failStaleEtudes(uid);
    const [quota, pending] = await Promise.all([etudeQuota(uid, dailyLimit()), pendingEtude(uid)]);
    res.json({ ...quota, pending, enabled: anthropic() !== null });
  } catch (err) {
    console.error("Failed to load etude quota:", err);
    res.status(500).json({ error: "Failed to load etude quota" });
  }
});

/**
 * Start an etude. Answers 202 straight away: Claude writes it in the background
 * and the server saves it to the user's history, so leaving or reloading the page
 * loses nothing. GET /api/etudes/:id says when it's done.
 */
router.post("/", requireAuth, refuseGuests, async (req: Request, res: Response) => {
  const parsed = EtudeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }
  const uid = req.user!.uid;
  const limit = dailyLimit();

  const client = anthropic();
  if (!client) {
    return res.status(503).json({ error: "Etude generation isn't set up on this server." });
  }
  // Shutting down: an etude started now would only be cut off.
  if (!acceptingEtudes()) {
    return res.status(503).json({ error: "The server is restarting. Try again in a moment." });
  }

  let reservation;
  try {
    // Refused if this etude, at the most it can cost, could take spending past the cap.
    if ((await spendTodayMicros()) + bookedCostMicros > dailySpendCapMicros()) {
      return res.status(503).json({
        error: "Etude generation is paused until midnight UTC. Try again tomorrow.",
      });
    }
    reservation = await reserveEtude(uid, limit, {
      model: ETUDE_MODEL,
      costMicros: bookedCostMicros,
    });
  } catch (err) {
    console.error("Failed to reserve an etude:", err);
    return res.status(500).json({ error: "Failed to start the etude" });
  }

  const { reserved, pending, quota } = reservation;
  if (pending) {
    return res.status(409).json({
      error: "An etude is already being written. It'll be ready shortly.",
      etude: pending,
      quota,
    });
  }
  if (!reserved) {
    return res.status(429).json({ error: `You've used all ${limit} etudes for today.`, quota });
  }

  startEtude(client, reserved.id, uid, parsed.data);
  res.status(202).json({
    etude: { id: reserved.id, status: reserved.status, error: null, exercise: null },
    quota,
  });
});

/** How an etude request is getting on, with the history row it was saved as once it's done. */
router.get("/:id", requireAuth, refuseGuests, async (req: Request, res: Response) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) return res.status(404).json({ error: "No such etude" });

  try {
    const uid = req.user!.uid;
    await failStaleEtudes(uid);
    const etude = await findEtude(uid, id.data);
    if (!etude) return res.status(404).json({ error: "No such etude" });
    res.json({ etude, quota: await etudeQuota(uid, dailyLimit()) });
  } catch (err) {
    console.error("Failed to load etude:", err);
    res.status(500).json({ error: "Failed to load the etude" });
  }
});

export default router;
