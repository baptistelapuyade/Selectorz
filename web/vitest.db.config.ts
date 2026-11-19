import { defineConfig } from "vitest/config";

// Datenbank-Tests laufen gegen lokales Supabase (npm run test:db).
export default defineConfig({
  test: { include: ["db-tests/**/*.test.ts"], fileParallelism: false, testTimeout: 20_000 },
});
