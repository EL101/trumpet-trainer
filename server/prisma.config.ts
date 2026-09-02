import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Migrate/introspect only. The runtime connection is made by the pg
    // adapter in src/db.ts, using this same variable.
    url: env("DATABASE_URL"),
  },
});
