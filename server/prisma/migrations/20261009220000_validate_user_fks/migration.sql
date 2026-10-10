-- Check the existing rows against the foreign keys that
-- 20260921230721_add_users_and_fks added NOT VALID. VALIDATE CONSTRAINT takes
-- a SHARE UPDATE EXCLUSIVE lock, so reads and writes continue during the scan.
-- It must run in a separate migration: in the same transaction as ADD
-- CONSTRAINT, the stronger lock that statement took would still be held.
-- On a database where the constraints are already valid, this is a no-op.
ALTER TABLE "history" VALIDATE CONSTRAINT "history_user_id_fkey";

ALTER TABLE "library" VALIDATE CONSTRAINT "library_user_id_fkey";
