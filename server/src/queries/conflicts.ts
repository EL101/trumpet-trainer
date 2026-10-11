import { Prisma } from "../generated/prisma/client.js";

/** Attempts before a write that keeps losing races gives up and throws. */
const MAX_ATTEMPTS = 5;

/** Whether `err` is Prisma's unique-constraint violation. */
export const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * Run `write`, and run it again if it fails on a unique constraint.
 *
 * For writes that read a number and then claim it, such as "one past the
 * user's highest generation": a concurrent write can claim it first, and the
 * unique index turns that into an error rather than a duplicate. `write` must
 * do its read itself, so each attempt sees the row that won.
 */
export async function retryOnConflict<T>(write: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await write();
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}
