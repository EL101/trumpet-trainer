-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "user_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("user_id")
);

-- The history/library foreign keys are added NOT VALID: Postgres then skips
-- scanning the existing rows, so the write-blocking lock is held only briefly.
-- 20261009220000_validate_user_fks checks the existing rows in its own
-- transaction, under a lock that lets writes through.
-- AddForeignKey
ALTER TABLE "history" ADD CONSTRAINT "history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "library" ADD CONSTRAINT "library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

-- Backfill a shell row for every uid that already owns exercises, so the
-- validation in the next migration passes. This runs after the constraints on
-- purpose: the old server keeps writing exercises during the deploy without
-- creating users rows, and any row it wrote before the constraints existed is
-- caught here, while every row after them is checked on insert.
-- email/display_name stay NULL until that user next signs in and GET
-- /api/profile refreshes them from the ID token. created_at is approximated
-- from their earliest exercise; updated_at has no DB default, so it must be
-- supplied explicitly.
INSERT INTO "users" ("id", "created_at", "updated_at")
SELECT user_id, MIN(created_at), NOW()
FROM (
    SELECT user_id, created_at FROM "history"
    UNION ALL
    SELECT user_id, created_at FROM "library"
) AS owners
GROUP BY user_id
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
