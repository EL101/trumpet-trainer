-- Keep etude requests when their user deletes their account: they're what the daily
-- spend cap sums, so cascading them away would hand back what those etudes cost (and
-- signing in again gives a new uid with a fresh quota). The row's user becomes null.
--
-- Deploy: DROP NOT NULL is a metadata change. Re-adding the foreign key checks every
-- row and holds SHARE ROW EXCLUSIVE on `users` and `etude_generations` until the
-- migration commits, blocking their writes (not reads) meanwhile. Both tables are
-- small, so that's a moment.

-- DropForeignKey
ALTER TABLE "etude_generations" DROP CONSTRAINT "etude_generations_user_id_fkey";

-- AlterTable
ALTER TABLE "etude_generations" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "etude_generations" ADD CONSTRAINT "etude_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
