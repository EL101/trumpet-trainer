-- Existing rows take CURRENT_TIMESTAMP, which gives guests already in the table
-- a full TTL of grace from deploy rather than sweeping them on the first pass.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "idx_users_anonymous_last_seen" ON "users"("is_anonymous", "last_seen_at");
