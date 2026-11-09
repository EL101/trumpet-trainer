-- Profile settings and the "exercises generated" count.
--
-- Deploy: adding a column with a constant default is a metadata change in Postgres 11+,
-- so it doesn't rewrite `users`. The backfill below touches each user's row once; the
-- table is small, and its row locks are only held for this transaction.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "exercises_generated" INTEGER NOT NULL DEFAULT 0;

-- History is pruned to each user's newest rows, so the true count is gone. The best
-- start is every exercise still on record: in history, or saved to the library after
-- history let it go.
UPDATE "users" u
SET "exercises_generated" = c.n
FROM (
    SELECT "user_id", COUNT(DISTINCT "exercise_id") AS n
    FROM (
        SELECT "user_id", "exercise_id" FROM "history"
        UNION ALL
        SELECT "user_id", "exercise_id" FROM "library"
    ) rows
    GROUP BY "user_id"
) c
WHERE c."user_id" = u."id";

-- One row per user who has saved settings; a user without one has the defaults. A new,
-- empty table, so its constraints and foreign key take no lock worth worrying about.
-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "low_min" INTEGER NOT NULL,
    "low_max" INTEGER NOT NULL,
    "med_min" INTEGER NOT NULL,
    "med_max" INTEGER NOT NULL,
    "high_min" INTEGER NOT NULL,
    "high_max" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id"),
    -- Prisma can't declare these; the API checks the same rules first. Each range is
    -- written MIDI numbers inside the trumpet's F#3 (54) to G6 (91), at least an octave
    -- (12) wide.
    CONSTRAINT "user_settings_ranges_on_the_horn" CHECK (
        "low_min" >= 54 AND "low_max" <= 91
        AND "med_min" >= 54 AND "med_max" <= 91
        AND "high_min" >= 54 AND "high_max" <= 91
    ),
    CONSTRAINT "user_settings_ranges_an_octave_wide" CHECK (
        "low_max" - "low_min" >= 12
        AND "med_max" - "med_min" >= 12
        AND "high_max" - "high_min" >= 12
    )
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
