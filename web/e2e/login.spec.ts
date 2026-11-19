import { expect, test } from "@playwright/test";
import { latestCode } from "./mailpit";

// Abnahme Login (PRD AUTH-01, AUTH-02, AUTH-05; Szenario 7 „Rückkehr zum Ziel“ vorbereitet).
const fresh = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function requestCode(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Email").fill(email);
  const sentAt = Date.now();
  await page.getByRole("button", { name: /send me a code/i }).click();
  await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
  return sentAt;
}

test("geschützte Seite schickt zum Login und merkt sich das Ziel", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login\?next=%2Fhome|\/login\?next=\/home/);
});

test("Login per Code im selben Fenster, danach zurück zum Ziel", async ({ page }) => {
  const email = fresh("ok");
  await page.goto("/login?next=/home");
  const sentAt = await requestCode(page, email);
  await expect(page.getByText(email)).toBeVisible();

  const code = await latestCode(email, sentAt);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: /log in/i }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(`Logged in as ${email}`)).toBeVisible();
});

test("falscher Code zeigt Fehler, Eingabe bleibt, neuer Code funktioniert", async ({ page }) => {
  const email = fresh("wrong");
  await page.goto("/login");
  const firstAt = await requestCode(page, email);
  const first = await latestCode(email, firstAt);
  const wrong = first === "000000" ? "111111" : "000000";

  await page.getByLabel("6-digit code").fill(wrong);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByText(/didn't work/i)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.waitForTimeout(1100); // lokales Supabase erlaubt eine Mail pro Sekunde
  const secondAt = Date.now();
  await page.getByRole("button", { name: /send a new code/i }).click();
  await expect(page.getByText(/new code sent/i)).toBeVisible();
  const second = await latestCode(email, secondAt);

  await page.getByLabel("6-digit code").fill(second);
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("ungültige Adresse wird abgefangen, ohne Mail", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: /send me a code/i }).click();
  // Browser-Validierung oder unsere Meldung: in beiden Fällen kein Code-Schritt
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("Logout beendet die Sitzung", async ({ page }) => {
  const email = fresh("logout");
  await page.goto("/login?next=/home");
  const sentAt = await requestCode(page, email);
  await page.getByLabel("6-digit code").fill(await latestCode(email, sentAt));
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});

test("fremdes Weiterleitungsziel wird ignoriert", async ({ page }) => {
  const email = fresh("redirect");
  await page.goto("/login?next=//evil.example");
  const sentAt = await requestCode(page, email);
  await page.getByLabel("6-digit code").fill(await latestCode(email, sentAt));
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/localhost:3000\/home$/);
});
