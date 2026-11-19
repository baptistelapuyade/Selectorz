import { expect, test } from "@playwright/test";
import { db, fresh, login, userId } from "./helpers";

test.afterAll(() => db.end());

// Abnahme Alpha-Betrieb (Plan vom 19.11.2026)

for (const path of ["/", "/login", "/imprint", "/privacy"]) {
  test(`1 · Feedback-Knopf auf ${path} sichtbar und mit einem Klick offen`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("button", { name: "Feedback", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
}

test("2 · Feedback ohne Text geht nicht, mit Text landet es mit Seite und Art", async ({ page }) => {
  const marker = `e2e-feedback-${Date.now()}-${Math.random()}`;
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /send feedback/i }).click();
  await expect(dialog.getByRole("heading", { name: /what's on your mind/i })).toBeVisible();

  await dialog.getByRole("radio", { name: "Idea" }).click();
  await dialog.getByLabel("Tell us more").fill(marker);
  await dialog.getByRole("button", { name: /send feedback/i }).click();
  await expect(dialog.getByRole("heading", { name: /got it/i })).toBeVisible();

  const { rows } = await db.query("select page, kind, contact_ok from public.feedback where message = $1", [marker]);
  expect(rows).toEqual([{ page: "/privacy", kind: "idea", contact_ok: true }]);
});

test("3 · Köderfeld: Bot-Feedback wird still verworfen", async ({ page }) => {
  const marker = `e2e-bot-${Date.now()}-${Math.random()}`;
  await page.goto("/imprint");
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="website"]').fill("https://spam.example", { force: true });
  await dialog.getByLabel("Tell us more").fill(marker);
  await dialog.getByRole("button", { name: /send feedback/i }).click();
  await expect(dialog.getByRole("heading", { name: /got it/i })).toBeVisible();
  const { rowCount } = await db.query("select 1 from public.feedback where message = $1", [marker]);
  expect(rowCount).toBe(0);
});

test("5 · Mail-Einstellung wird gespeichert, Entblocken funktioniert", async ({ page }) => {
  const email = fresh("settings");
  const other = fresh("blocked");
  await login(page, email);
  // zweites Konto anlegen und blockieren (direkt in der Datenbank)
  const me = await userId(email);
  const { rows } = await db.query("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [other]);
  await db.query("update public.accounts set display_name = 'Marlon' where id = $1", [rows[0].id]);
  await db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [me, rows[0].id]);

  await page.goto("/settings");
  const box = page.getByLabel(/email when it's my turn/i);
  await expect(box).toBeChecked();
  await box.uncheck();
  // auf die Server-Antwort warten, sonst lädt der Test neu, bevor gespeichert ist
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/settings")),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await page.reload();
  await expect(page.getByLabel(/email when it's my turn/i)).not.toBeChecked();

  await expect(page.getByText("Marlon")).toBeVisible();
  await page.getByRole("button", { name: "Unblock" }).click();
  await expect(page.getByText(/^Nobody\./)).toBeVisible();
});

test("4 · Konto löschen: Login weg, Bestätigung nötig", async ({ page }) => {
  const email = fresh("delete");
  await login(page, email);
  await page.goto("/settings/delete");
  await page.getByLabel(/type your email/i).fill("wrong@example.com");
  await page.getByRole("button", { name: /delete my account/i }).click();
  await expect(page.getByText(/type your email exactly/i)).toBeVisible();
  expect(await userId(email)).toBeTruthy();

  await page.getByLabel(/type your email/i).fill(email);
  await page.getByRole("button", { name: /delete my account/i }).click();
  await expect(page).toHaveURL(/\/\?account=deleted$/);
  expect(await userId(email)).toBeUndefined();
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});

test("6 · PostHog: keine Cookies, nichts im Browser gespeichert, keine Mails oder Query-Strings in Events", async ({ page, context }) => {
  test.skip(!process.env.NEXT_PUBLIC_POSTHOG_HOST, "nur mit Test-Host");
  const bodies: string[] = [];
  await page.route(`${process.env.NEXT_PUBLIC_POSTHOG_HOST}/**`, async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/login?next=/home");
  await page.getByLabel("Email").fill(fresh("ph"));
  await page.getByRole("button", { name: /send me a code/i }).click();
  await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
  await expect.poll(() => bodies.join("\n"), { timeout: 15_000 }).toContain("login_code_requested");

  const all = bodies.join("\n");
  expect(all).toContain("$pageview");
  expect(all).not.toMatch(/[\w.+-]+@example\.com/);
  expect(all).not.toContain("next=");
  // Erlaubt sind nur die Login-Cookies von Supabase (sb-…); PostHog setzt keine.
  expect((await context.cookies()).filter((c) => !c.name.startsWith("sb-"))).toEqual([]);
  const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  expect(stored.filter((k) => k.toLowerCase().includes("ph"))).toEqual([]);
});

test("7 · Datenschutz von jeder Seite mit einem Klick", async ({ page }) => {
  for (const path of ["/", "/login", "/imprint"]) {
    await page.goto(path);
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
    await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeVisible();
  }
});
