-- Allow one history row per (user, generation). The client already keys history
-- by generation number, and inserts now skip a generation the user already has,
-- so saving the same exercise twice can no longer leave a copy behind.
--
-- Prisma runs this file as one transaction. The lock blocks writes, not reads,
-- until it commits: the old server keeps inserting while this deploys, and a
-- copy it slipped in between the DELETE and the CREATE INDEX would fail the
-- index build. Once the index exists, the old server's re-saves fail with a
-- unique violation instead, which its clients only log.
LOCK TABLE "history" IN EXCLUSIVE MODE;

-- Delete existing copies, keeping the oldest row for each (user, generation).
-- These were almost all re-saves of the same exercise. Where two rows differ
-- (two tabs generating at once), the client could only ever show one of them.
DELETE FROM "history" AS copy
USING "history" AS original
WHERE original.user_id = copy.user_id
  AND original.generation_num = copy.generation_num
  AND (original.created_at, original.id) < (copy.created_at, copy.id);

-- The unique index serves the same lookups the old index did.
DROP INDEX "idx_history_user_generation";

-- CreateIndex
CREATE UNIQUE INDEX "uq_history_user_generation" ON "history"("user_id", "generation_num");
