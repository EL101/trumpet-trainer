import { prisma } from "../db.js";
import { EtudeStatus } from "../generated/prisma/enums.js";
import { isUniqueViolation } from "./conflicts.js";

/** How far back the daily quota looks: a rolling 24 hours, not a calendar day. */
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * An etude still pending after this long was cut off: the server crashed or was
 * killed while writing it. (A clean shutdown marks its own etudes failed, with
 * failInterruptedEtudes.) The longest a write can take is about 4 minutes: two attempts, each
 * a call of up to a minute that the SDK retries once on a timeout. This leaves
 * room for that. One that does finish later still counts (see finishEtude).
 */
export const STALE_AFTER_MS = 10 * 60 * 1000;

const STALE_MESSAGE = "Writing that etude was interrupted. Try again.";
const RESTART_MESSAGE = "The server restarted while writing your etude. Try again.";

/** Requests that use up quota: still being written, or delivered. */
const COUNTED: EtudeStatus[] = [EtudeStatus.PENDING, EtudeStatus.SUCCEEDED];

export type QuotaStatus = {
  limit: number;
  remaining: number;
  /** When the oldest counted request leaves the window and frees a slot, if any are counted. */
  resetsAt: Date | null;
};

/** The user's quota. Run failStaleEtudes first, so etudes cut off give their slots back. */
export async function etudeQuota(userId: string, limit: number): Promise<QuotaStatus> {
  const where = {
    userId,
    status: { in: COUNTED },
    createdAt: { gt: new Date(Date.now() - QUOTA_WINDOW_MS) },
  };
  const [used, oldest] = await Promise.all([
    prisma.etudeGeneration.count({ where }),
    prisma.etudeGeneration.findFirst({
      where,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: oldest ? new Date(oldest.createdAt.getTime() + QUOTA_WINDOW_MS) : null,
  };
}

/**
 * Mark the user's pending etudes that were cut off as failed, giving their quota
 * back. Each keeps its booked cost, since what it spent before it stopped is unknown.
 * Run it once per request, before reading the user's quota or etudes.
 */
export function failStaleEtudes(userId: string) {
  return prisma.etudeGeneration.updateMany({
    where: {
      userId,
      status: EtudeStatus.PENDING,
      createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    data: { status: EtudeStatus.FAILED, error: STALE_MESSAGE },
  });
}

/** An etude request as the client sees it, with the history row it was saved as. */
async function withExercise(row: {
  id: string;
  userId: string;
  status: EtudeStatus;
  exerciseId: string | null;
  error: string | null;
}) {
  const exercise = row.exerciseId
    ? await prisma.history.findFirst({ where: { userId: row.userId, exerciseId: row.exerciseId } })
    : null;
  return { id: row.id, status: row.status, error: row.error, exercise };
}

export type EtudeView = Awaited<ReturnType<typeof withExercise>>;

/** The user's etude being written now, if there is one. Run failStaleEtudes first. */
export async function pendingEtude(userId: string): Promise<EtudeView | null> {
  const row = await prisma.etudeGeneration.findFirst({
    where: { userId, status: EtudeStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
  return row ? withExercise(row) : null;
}

/**
 * One of the user's etude requests, or null if there's no such request of theirs.
 * Run failStaleEtudes first, so one that was cut off doesn't show as still pending.
 */
export async function findEtude(userId: string, id: string): Promise<EtudeView | null> {
  const row = await prisma.etudeGeneration.findFirst({ where: { id, userId } });
  return row ? withExercise(row) : null;
}

/**
 * Take one of the user's etudes for today. Refused while another is still being
 * written (`pending`), or when none are left. Only one etude per user can be
 * pending (a unique index), so of two requests at once only one gets in, and the
 * quota can't be overshot either; the other is told about the one that did.
 * `costMicros` is what it's booked at against the spend cap until it's written.
 */
export async function reserveEtude(
  userId: string,
  limit: number,
  booking: { model: string; costMicros: number },
) {
  // Cut-off etudes first, so they neither block this one nor use up its quota.
  await failStaleEtudes(userId);
  const [quota, pending] = await Promise.all([etudeQuota(userId, limit), pendingEtude(userId)]);
  if (pending) return { reserved: null, pending, quota };
  if (quota.remaining === 0) return { reserved: null, pending: null, quota };

  try {
    const reserved = await prisma.etudeGeneration.create({ data: { userId, ...booking } });
    const resetsAt = quota.resetsAt ?? new Date(reserved.createdAt.getTime() + QUOTA_WINDOW_MS);
    return {
      reserved,
      pending: null,
      quota: { limit, remaining: quota.remaining - 1, resetsAt },
    };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Another request from this user started one between the check and the insert.
    return { reserved: null, pending: await pendingEtude(userId), quota };
  }
}

/**
 * Record how a request ended and what it cost: the history row it was saved as,
 * or the message to show for its failure. This overwrites a request already given
 * up as stale, so an etude that finishes late still counts and its cost is still
 * recorded; a success clears the stale message.
 */
export function finishEtude(
  id: string,
  outcome:
    { status: "SUCCEEDED"; exerciseId: string; error: null } | { status: "FAILED"; error: string },
  spent: { inputTokens: number; outputTokens: number; costMicros: number },
) {
  return prisma.etudeGeneration.update({ where: { id }, data: { ...outcome, ...spent } });
}

/**
 * What every etude since midnight UTC has cost, in millionths of a dollar. Etudes
 * still being written count at their booked cost.
 */
export async function spendTodayMicros(now = new Date()): Promise<number> {
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { _sum } = await prisma.etudeGeneration.aggregate({
    where: { createdAt: { gte: midnight } },
    _sum: { costMicros: true },
  });
  return _sum.costMicros ?? 0;
}

/**
 * Mark etudes this process was writing when it shut down as failed, so their
 * players hear now rather than at the stale cutoff. Only ones still pending: one
 * that finished meanwhile keeps its result. Each keeps its booked cost.
 */
export function failInterruptedEtudes(ids: readonly string[]) {
  return prisma.etudeGeneration.updateMany({
    where: { id: { in: [...ids] }, status: EtudeStatus.PENDING },
    data: { status: EtudeStatus.FAILED, error: RESTART_MESSAGE },
  });
}
