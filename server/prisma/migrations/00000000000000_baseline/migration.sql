-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "time_sig" TEXT NOT NULL,
    "music_key" TEXT NOT NULL,
    "note_range" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "generation_num" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "time_sig" TEXT NOT NULL,
    "music_key" TEXT NOT NULL,
    "note_range" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "generation_num" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_history_user_generation" ON "history"("user_id", "generation_num" DESC);

-- CreateIndex
CREATE INDEX "idx_library_user_created" ON "library"("user_id", "created_at" DESC);
