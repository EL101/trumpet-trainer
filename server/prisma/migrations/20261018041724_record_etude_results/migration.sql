-- Etudes are now written in the background and saved to history by the server,
-- so each request records the history row it produced, or why it failed.
-- Nullable columns on a small table: no rewrite, safe to deploy.

-- AlterTable
ALTER TABLE "etude_generations" ADD COLUMN     "error" TEXT,
ADD COLUMN     "exercise_id" UUID;
