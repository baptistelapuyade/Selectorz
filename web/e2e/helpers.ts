import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { latestCode } from "./mailpit";

export const fresh = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

export const db = new pg.Pool({
  connectionString: process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  max: 2,
});

export async function login(page: Page, email: string, next = "/home") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  const sentAt = Date.now();
  await page.getByRole("button", { name: /send me a code/i }).click();
  await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
  await page.getByLabel("6-digit code").fill(await latestCode(email, sentAt));
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/]/g, "\\/")}$`));
}

export async function userId(email: string): Promise<string> {
  const { rows } = await db.query("select id from auth.users where email = $1", [email]);
  return rows[0]?.id;
}
