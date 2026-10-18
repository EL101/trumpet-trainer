import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { EtudeRequestSchema } from "../schema/index.js";
import { anthropic, costMicros, ETUDE_MODEL } from "../etudes/claude.js";
import { EtudeFailure, writeEtude, type TokenUsage } from "../etudes/generate.js";
import {
  etudeQuota,
  finishEtude,
  releaseEtude,
  reserveEtude,
  spendTodayMicros,
} from "../queries/etudes.js";

const router = Router();

/** A non-negative number from the environment, or `fallback` when it's unset or invalid. */
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = Number(raw);
  return raw && Number.isFinite(value) && value >= 0 ? value : fallback;
}

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

router.get("/quota", requireAuth, refuseGuests, async (req: Request, res: Response) => {
  try {
    res.json(await etudeQuota(req.user!.uid, dailyLimit()));
  } catch (err) {
    console.error("Failed to load etude quota:", err);
    res.status(500).json({ error: "Failed to load etude quota" });
  }
});

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

  let reservation;
  try {
    if ((await spendTodayMicros()) >= dailySpendCapMicros()) {
      return res.status(503).json({
        error: "Etude generation is paused until midnight UTC. Try again tomorrow.",
      });
    }
    reservation = await reserveEtude(uid, limit, ETUDE_MODEL);
  } catch (err) {
    console.error("Failed to reserve an etude:", err);
    return res.status(500).json({ error: "Failed to start the etude" });
  }

  const { reserved, quota } = reservation;
  if (!reserved) {
    return res.status(429).json({
      error: `You've used all ${limit} etudes for today.`,
      quota,
    });
  }

  try {
    const { bars, usage } = await writeEtude(client, parsed.data);
    await settle(reserved.id, "SUCCEEDED", usage);
    res.json({ bars, quota });
  } catch (err) {
    const usage = err instanceof EtudeFailure ? err.usage : { inputTokens: 0, outputTokens: 0 };
    console.error("Failed to write an etude:", err);
    await settle(reserved.id, "FAILED", usage);
    const after = await etudeQuota(uid, limit).catch(() => quota);

    if (err instanceof EtudeFailure && err.kind === "unavailable") {
      return res.status(503).json({
        error: "The etude writer can't be reached right now. Try again in a minute.",
        quota: after,
      });
    }
    if (err instanceof EtudeFailure && err.kind === "bad_output") {
      return res.status(502).json({
        error: "Couldn't write a usable etude this time. Try again.",
        quota: after,
      });
    }
    res.status(500).json({ error: "Failed to write the etude", quota: after });
  }
});

/**
 * Record what a request cost. One that spent nothing is dropped altogether; a
 * failed one that did spend stays, so it counts toward the spend cap, but not
 * toward the user's quota. Never throws: the user's response matters more.
 */
async function settle(id: string, status: "SUCCEEDED" | "FAILED", usage: TokenUsage) {
  try {
    if (status === "FAILED" && usage.inputTokens === 0 && usage.outputTokens === 0) {
      await releaseEtude(id);
    } else {
      const cost = costMicros(ETUDE_MODEL, usage.inputTokens, usage.outputTokens);
      await finishEtude(id, status, { ...usage, costMicros: cost });
    }
  } catch (err) {
    console.error(`Failed to record etude ${id} as ${status}:`, err);
  }
}

export default router;
