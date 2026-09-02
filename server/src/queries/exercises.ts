import camelcaseKeys from "camelcase-keys";
import { pool } from "../db.js";
import type { ExerciseInput, ExerciseTable } from "../schema/index.js";

// Table names below are interpolated, never parameterised, so they must only ever come
// from the ExerciseTable union - never from request data.
// `history` is browsed newest-generation-first; `library` newest-saved-first.
const ORDER_BY: Record<ExerciseTable, string> = {
  history: "generation_num DESC",
  library: "created_at DESC",
};

export async function listExercises(table: ExerciseTable, userId: string) {
  const { rows } = await pool.query(
    `SELECT id, notes, time_sig, music_key, note_range AS range, difficulty, generation_num
       FROM ${table}
      WHERE user_id = $1
      ORDER BY ${ORDER_BY[table]}`,
    [userId],
  );
  return camelcaseKeys(rows, { deep: true });
}

export async function insertExercise(
  table: ExerciseTable,
  userId: string,
  exercise: ExerciseInput,
) {
  const { rows } = await pool.query(
    `INSERT INTO ${table} (id, user_id, notes, time_sig, music_key, note_range, difficulty, generation_num)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, notes, time_sig, music_key, note_range AS range, difficulty, generation_num, created_at`,
    [
      crypto.randomUUID(),
      userId,
      exercise.notes,
      exercise.timeSig,
      exercise.musicKey,
      exercise.noteRange,
      exercise.difficulty,
      exercise.generationNum,
    ],
  );
  return camelcaseKeys(rows, { deep: true })[0];
}

export async function deleteExercises(table: ExerciseTable, userId: string) {
  const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  return rowCount ?? 0;
}
