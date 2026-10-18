-- Record each request to Claude for an etude, for the per-user daily quota and
-- the global daily spend cap. A new, empty table, so adding its foreign key
-- takes no lock worth worrying about on deploy.

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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etude_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_etude_generations_user_created" ON "etude_generations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_etude_generations_created" ON "etude_generations"("created_at");

-- AddForeignKey
ALTER TABLE "etude_generations" ADD CONSTRAINT "etude_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
