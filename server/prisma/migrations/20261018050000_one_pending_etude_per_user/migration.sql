-- Only one etude per user can be being written at a time. Until now that was
-- held by an advisory lock in the server; a partial unique index makes the
-- database enforce it, so two requests at once can't both start one.

-- Clean-up: should a user have more than one pending row (cut off by a restart),
-- keep the newest pending and mark the rest failed, or the index can't be built.
UPDATE "etude_generations" AS e
SET "status" = 'FAILED', "error" = 'Writing that etude was interrupted. Try again.'
WHERE e."status" = 'PENDING'
  AND EXISTS (
    SELECT 1 FROM "etude_generations" AS newer
    WHERE newer."user_id" = e."user_id"
      AND newer."status" = 'PENDING'
      AND newer."created_at" > e."created_at"
  );

-- CreateIndex
CREATE UNIQUE INDEX "uq_etude_generations_user_pending" ON "etude_generations"("user_id") WHERE (status = 'PENDING');
