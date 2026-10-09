import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://trumpet:trumpet@localhost:5433/trumpet_trainer_test";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ["test/globalSetup.ts"],
    setupFiles: ["test/setup.ts"],
    // Every file shares one database and truncates it between tests.
    fileParallelism: false,
  },
});
