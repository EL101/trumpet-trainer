-- Scored runs from the player's Play mode: four 0-100 scores, their weighted average
-- and the feedback under each, newest read back per exercise. A new, empty table, so
-- its foreign key and index take no lock worth worrying about on deploy.
--
-- Scores outlive their exercises, so a user's progress doesn't change when history is
-- pruned or an exercise is deleted: each keeps what its exercise was (copied from the
-- history or library row when it's saved), and the hourly prune only clears the four
-- feedback columns, together.

-- CreateTable
CREATE TABLE "practice_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" UUID NOT NULL,
    "exercise_type" "exercise_type" NOT NULL,
    "time_sig" TEXT NOT NULL,
    "music_key" TEXT NOT NULL,
    "note_range" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "tempo" INTEGER NOT NULL,
    "overall" INTEGER NOT NULL,
    "right_notes_score" INTEGER NOT NULL,
    "rhythm_score" INTEGER NOT NULL,
    "intonation_score" INTEGER NOT NULL,
    "tone_score" INTEGER NOT NULL,
    "right_notes_feedback" JSONB,
    "rhythm_feedback" JSONB,
    "intonation_feedback" JSONB,
    "tone_feedback" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_scores_pkey" PRIMARY KEY ("id"),
    -- Prisma can't declare these; the API checks the same ranges first.
    CONSTRAINT "practice_scores_scores_range" CHECK (
        "overall" BETWEEN 0 AND 100
        AND "right_notes_score" BETWEEN 0 AND 100
        AND "rhythm_score" BETWEEN 0 AND 100
        AND "intonation_score" BETWEEN 0 AND 100
        AND "tone_score" BETWEEN 0 AND 100
    ),
    -- Feedback is cleared all at once (null), or kept all at once.
    CONSTRAINT "practice_scores_feedback_cleared_together" CHECK (
        ("right_notes_feedback" IS NULL) = ("rhythm_feedback" IS NULL)
        AND ("right_notes_feedback" IS NULL) = ("intonation_feedback" IS NULL)
        AND ("right_notes_feedback" IS NULL) = ("tone_feedback" IS NULL)
    )
);

-- Every run of an exercise, newest first: the prune counts the newer runs of each one
-- with feedback.
-- CreateIndex
CREATE INDEX "idx_practice_scores_user_exercise_created" ON "practice_scores"("user_id", "exercise_id", "created_at" DESC);

-- A user's runs by when they were saved: the rate limit counts those in the last minute
-- and the last day on every save, which would otherwise read every run the user has.
-- CreateIndex
CREATE INDEX "idx_practice_scores_user_created" ON "practice_scores"("user_id", "created_at" DESC);

-- Only the runs that still have feedback, which stay few (an exercise's newest 20) while
-- the table keeps every run: the newest one read back per exercise, and the hourly
-- prune's search for feedback to clear, which would otherwise read the whole table.
-- CreateIndex
CREATE INDEX "idx_practice_scores_with_feedback" ON "practice_scores"("user_id", "exercise_id", "created_at" DESC) WHERE ("right_notes_feedback" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "practice_scores" ADD CONSTRAINT "practice_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
