-- Idempotent so the migrate scripts can replay the whole folder safely.
ALTER TABLE library
  ADD COLUMN IF NOT EXISTS note_range    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS difficulty    TEXT NOT NULL DEFAULT '';
