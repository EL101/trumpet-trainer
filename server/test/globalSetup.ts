import { execSync } from "node:child_process";
import pg from "pg";
import { TEST_DATABASE_URL } from "../vitest.config.js";

/** Create the test database if needed and bring it up to the latest migration. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  // Every test truncates all tables, so never let this point at real data.
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${dbName}": name must end in _test`);
  }

  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Can't reach Postgres for tests at ${admin.host}. Start it with \`npm run db:up\` from the repo root.`,
      { cause: err },
    );
  }
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      dbName,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
    });
  } catch (err) {
    // The captured output is Buffers, which Vitest prints as byte arrays.
    const { stdout, stderr } = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `prisma migrate deploy failed:\n${stdout?.toString() ?? ""}${stderr?.toString() ?? ""}`,
      { cause: err },
    );
  }
}
