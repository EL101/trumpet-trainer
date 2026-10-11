-- Give every exercise an id that history and the library share. The client makes
-- it when it generates the exercise, so a library row still matches its history
-- row after "Clear history" renumbers it. The default covers the old server and
-- old clients, which don't send one, while this deploys and after.
--
-- Prisma runs this file as one transaction. The ALTERs lock both tables until it
-- commits; they hold at most 100 history rows per user and a short library, so
-- the old server's requests wait briefly rather than fail.

-- History: every existing row gets an id of its own. A volatile default fills
-- each row, so this rewrites the table.
ALTER TABLE "history" ADD COLUMN "exercise_id" UUID NOT NULL DEFAULT gen_random_uuid();

-- Library: link each saved exercise to the history row it came from, matched the
-- way the client matched them until now (same user, generation and notes).
ALTER TABLE "library" ADD COLUMN "exercise_id" UUID;

-- An exercise saved twice links only its oldest copy: the unique index below
-- allows one row per exercise, and no saved row is deleted to make room.
UPDATE "library" AS l
SET "exercise_id" = linked.exercise_id
FROM (
    SELECT DISTINCT ON (h.id) l2.id AS library_id, h.exercise_id
    FROM "library" AS l2
    JOIN "history" AS h
      ON h.user_id = l2.user_id
     AND h.generation_num = l2.generation_num
     AND h.notes = l2.notes
    ORDER BY h.id, l2.created_at, l2.id
) AS linked
WHERE l.id = linked.library_id;

-- The rest (no history row left to match, or a later copy) get ids of their own.
UPDATE "library" SET "exercise_id" = gen_random_uuid() WHERE "exercise_id" IS NULL;

ALTER TABLE "library"
    ALTER COLUMN "exercise_id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "exercise_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_library_user_exercise" ON "library"("user_id", "exercise_id");
