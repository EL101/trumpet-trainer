-- Record which kind of exercise each row is. Every row so far came from the
-- random generator, the only one that exists, so RANDOM is the right backfill.
-- The default also covers the old server, which keeps inserting rows without a
-- type while this deploys. A constant default is stored in the catalog rather
-- than written into every row, so neither ALTER rewrites its table.

-- CreateEnum
CREATE TYPE "exercise_type" AS ENUM ('LONG_TONES', 'SCALES', 'LIP_SLURS', 'ETUDES', 'RANDOM');

-- AlterTable
ALTER TABLE "history" ADD COLUMN     "exercise_type" "exercise_type" NOT NULL DEFAULT 'RANDOM';

-- AlterTable
ALTER TABLE "library" ADD COLUMN     "exercise_type" "exercise_type" NOT NULL DEFAULT 'RANDOM';
