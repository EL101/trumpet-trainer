CREATE TABLE IF NOT EXISTS history (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes            TEXT NOT NULL,
  time_sig         TEXT NOT NULL,
  music_key        TEXT NOT NULL,
  note_range       TEXT NOT NULL,
  difficulty       TEXT NOT NULL,
  generation_num   INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);