-- Both tables are only ever read as "this user's rows, newest first"
-- (see server/src/queries/exercises.ts), so index on that shape.
DROP INDEX IF EXISTS idx_library_id_created;

CREATE INDEX IF NOT EXISTS idx_library_user_created
  ON library (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_user_generation
  ON history (user_id, generation_num DESC);
