ALTER TABLE history DROP CONSTRAINT IF EXISTS history_user_id_fkey;

ALTER TABLE library DROP CONSTRAINT IF EXISTS library_user_id_fkey;

DROP TABLE IF EXISTS users;