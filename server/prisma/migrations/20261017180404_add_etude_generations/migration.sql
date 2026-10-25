-- Record each request to Claude for an etude: it drives the per-user daily quota
-- and the global daily spend cap, and records how each etude ended (the history
-- row it was saved as, or why it failed). A new, empty table, so its foreign key
-- and indexes take no lock worth worrying about on deploy.

-- CreateEnum
CREATE TYPE "etude_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "etude_generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "etude_status" NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" INTEGER NOT NULL DEFAULT 0,
    "exercise_id" UUID,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etude_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_etude_generations_user_created" ON "etude_generations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_etude_generations_created" ON "etude_generations"("created_at");

-- One etude being written per user at a time, enforced by the database, so two
-- requests at once can't both start one.
-- CreateIndex
CREATE UNIQUE INDEX "uq_etude_generations_user_pending" ON "etude_generations"("user_id") WHERE (status = 'PENDING');

-- AddForeignKey
ALTER TABLE "etude_generations" ADD CONSTRAINT "etude_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
