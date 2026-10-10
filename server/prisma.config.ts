import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Migrate/introspect only; the runtime connection is made in src/db.ts.
    // Migrations need a direct connection: a transaction-mode pooler such as
    // Neon's drops the session advisory lock that migrate deploy holds.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
