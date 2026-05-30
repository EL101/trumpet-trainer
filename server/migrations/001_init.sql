CREATE TABLE IF NOT EXISTS users (
  id     TEXT PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE If NOT EXISTS library (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes            TEXT NOT NULL,
  time_sig         TEXT NOT NULL,
  music_key        TEXT NOT NULL,
  generation_num   INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_id_created
  ON library (id, created_at DESC);