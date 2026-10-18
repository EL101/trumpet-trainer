import { prisma } from "../db.js";
import { EtudeStatus } from "../generated/prisma/enums.js";

/** How far back the daily quota looks: a rolling 24 hours, not a calendar day. */
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Requests that use up quota: still being written, or delivered. */
const COUNTED: EtudeStatus[] = [EtudeStatus.PENDING, EtudeStatus.SUCCEEDED];

export type QuotaStatus = {
  limit: number;
  remaining: number;
  /** When the oldest counted request leaves the window and frees a slot, if any are counted. */
  resetsAt: Date | null;
};

async function quotaWithin(
  db: Pick<typeof prisma, "etudeGeneration">,
  userId: string,
  limit: number,
): Promise<QuotaStatus> {
  const where = {
    userId,
    status: { in: COUNTED },
    createdAt: { gt: new Date(Date.now() - QUOTA_WINDOW_MS) },
  };
  const [used, oldest] = await Promise.all([
    db.etudeGeneration.count({ where }),
    db.etudeGeneration.findFirst({
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

export function etudeQuota(userId: string, limit: number) {
  return quotaWithin(prisma, userId, limit);
}

/**
 * Take one of the user's etudes for today, or report that none are left.
 * The count and the insert share a transaction holding a per-user lock, so two
 * requests at once can't both take the last one.
 */
export async function reserveEtude(userId: string, limit: number, model: string) {
  return prisma.$transaction(async (tx) => {
    // Raw SQL: Prisma has no way to take an advisory lock. Held until the
    // transaction ends, and only blocks other requests from this same user.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}))`;

    const quota = await quotaWithin(tx, userId, limit);
    if (quota.remaining === 0) return { reserved: null, quota };

    const reserved = await tx.etudeGeneration.create({ data: { userId, model } });
    const resetsAt = quota.resetsAt ?? new Date(reserved.createdAt.getTime() + QUOTA_WINDOW_MS);
    return { reserved, quota: { limit, remaining: quota.remaining - 1, resetsAt } };
  });
}

/** Record how a reserved request ended and what it cost. */
export function finishEtude(
  id: string,
  status: "SUCCEEDED" | "FAILED",
  spent: { inputTokens: number; outputTokens: number; costMicros: number },
) {
  return prisma.etudeGeneration.update({ where: { id }, data: { status, ...spent } });
}

/** Give back a reservation that cost nothing, so it neither uses quota nor counts as spend. */
export function releaseEtude(id: string) {
  return prisma.etudeGeneration.delete({ where: { id } });
}

/** What every etude since midnight UTC has cost, in millionths of a dollar. */
export async function spendTodayMicros(now = new Date()): Promise<number> {
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { _sum } = await prisma.etudeGeneration.aggregate({
    where: { createdAt: { gte: midnight } },
    _sum: { costMicros: true },
  });
  return _sum.costMicros ?? 0;
}
