import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL in production; local Docker doesn't.
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});

// Optional: log connection errors so you notice them
pool.on("error", (err) => {
  console.error("Unexpected database error", err);
});
