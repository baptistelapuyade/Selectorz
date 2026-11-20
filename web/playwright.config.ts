import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Schutz: Browser-Tests schreiben in die Datenbank. Nie gegen ein echtes Supabase-Projekt laufen lassen.
const fromFile = existsSync(".env.local") ? /^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m.exec(readFileSync(".env.local", "utf8"))?.[1] : undefined;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromFile ?? "";
if (/\.supabase\.(co|com|in)/.test(supabaseUrl)) {
  throw new Error(`Browser-Tests abgebrochen: Supabase zeigt auf ${new URL(supabaseUrl).host}. Nur lokales Supabase erlaubt.`);
}

// Browser-Tests gegen lokales Supabase (supabase start) und den gebauten Next-Server.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0, // keine Wiederholungen: wackelige Tests sollen auffallen
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
