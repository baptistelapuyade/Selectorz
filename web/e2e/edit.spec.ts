import { expect, test, type Page } from "@playwright/test";
import { db, fresh, login, userId } from "./helpers";

// Abnahme M1c Teil 1 „Profil bearbeiten“ (Plan vom 23.11.2026): Editor, Veröffentlichen, Verwerfen, Offline, Home.

async function liveProfile(page: Page, name = "Luma Reyes") {
  const email = fresh("edit");
  await login(page, email);
  const uid = await userId(email);
  const handle = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const c = await db.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    await c.query("select public.create_and_publish_profile($1, $2, '{House}', '{Vinyl}', 'Berlin', 'day', $3, $4)", [
      handle,
      name,
      `${uid}/avatar.png`,
      JSON.stringify({ kind: "mix", title: "My sound", content: { mixes: [{ url: "https://soundcloud.com/luma/late-hours-mix", title: "Late Hours Mix", provider: "soundcloud" }] } }),
    ]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  return handle;
}

const status = (page: Page) => page.getByTestId("status");

async function editBasics(page: Page) {
  await page.getByRole("button", { name: "Edit basics" }).first().click();
  await expect(page.getByRole("dialog", { name: "Your basics" })).toBeVisible();
}
async function done(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: /^done/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function saved(page: Page) {
  // Entwurf ist gespeichert, wenn der Status „Änderungen“ zeigt und kein Speichern mehr läuft
  await expect(status(page)).toContainText(/CHANGES/);
  await page.waitForTimeout(1200);
}

test("E1: Name ändern bleibt im Entwurf, „Publish changes“ bringt ihn auf die öffentliche Seite", async ({ page, context }) => {
  const handle = await liveProfile(page);
  await page.goto("/edit");
  await expect(status(page)).toContainText("LIVE");
  await expect(status(page)).not.toContainText("CHANGES");

  await editBasics(page);
  await page.getByLabel("DJ name").fill("Luma Edited");
  await page.getByLabel(/About you/).fill("Sundays, slow and warm.");
  await done(page);
  await saved(page);

  const pub = await context.newPage();
  await pub.goto(`/${handle}`);
  await expect(pub.getByRole("heading", { level: 1, name: "Luma Reyes" })).toBeVisible();

  await page.getByRole("button", { name: /publish changes/i }).click();
  await expect(page.getByText(/Published\. Your page shows the new version/)).toBeVisible();
  await expect(status(page)).not.toContainText("CHANGES");

  await pub.reload();
  await expect(pub.getByRole("heading", { level: 1, name: "Luma Edited" })).toBeVisible();
  await expect(pub.getByText("Sundays, slow and warm.")).toBeVisible();
});

test("E2: Section hinzufügen, nach oben schieben, andere ausblenden, veröffentlichen", async ({ page, context }) => {
  const handle = await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "+ Add a section" }).click();
  await page.getByRole("button", { name: /^Set openers/ }).click();
  const input = page.getByLabel("Link for track 1");
  await input.fill(`https://soundcloud.com/tide-archive/morning-static-${Date.now()}`);
  await input.press("Enter");
  await page.getByRole("button", { name: "Add track" }).click();
  await expect(page.getByRole("dialog").getByRole("list", { name: "Tracks" })).toContainText(/Morning Static/);
  await done(page);

  await page.getByRole("button", { name: "Move Set openers up" }).click();
  await page.getByRole("switch", { name: "Show My sound on your page" }).click();
  await expect(page.getByRole("list", { name: "Sections" }).getByRole("listitem").first()).toContainText("Set openers");
  await saved(page);

  await page.getByRole("button", { name: /publish changes/i }).click();
  await expect(page.getByText(/Published\./)).toBeVisible();
  const pub = await context.newPage();
  await pub.goto(`/${handle}`);
  await expect(pub.getByRole("heading", { name: /Set openers/ })).toBeVisible();
  await expect(pub.getByRole("heading", { name: /My sound/ })).toHaveCount(0);
});

test("E3: Ohne sichtbare Musik kein Veröffentlichen; „Discard changes“ holt den alten Stand zurück", async ({ page }) => {
  await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("switch", { name: "Show My sound on your page" }).click();
  await page.getByRole("button", { name: /publish changes/i }).click();
  await expect(page.getByText(/Add a visible track or mix first/)).toBeVisible();

  await page.getByRole("button", { name: /discard changes/i }).click();
  await expect(page.getByText(/Changes discarded/)).toBeVisible();
  await expect(page.getByRole("switch", { name: "Show My sound on your page" })).toHaveAttribute("aria-checked", "true");
  await expect(status(page)).not.toContainText("CHANGES");
});

test("E4: Offline nehmen mit Rückfrage, Link zeigt „No page here“, wieder veröffentlichen", async ({ page, context }) => {
  const handle = await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "Take my page offline" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Take your page offline?" });
  await expect(dialog.getByRole("button", { name: "Keep it live" })).toBeFocused();
  await dialog.getByRole("button", { name: "Take it offline" }).click();
  await expect(status(page)).toContainText("OFFLINE");

  const pub = await context.newPage();
  await pub.goto(`/${handle}`);
  await expect(pub.getByRole("heading", { level: 1, name: /no page/i })).toBeVisible();

  await page.getByRole("button", { name: /publish again/i }).click();
  await expect(status(page)).not.toContainText("OFFLINE");
  await pub.reload();
  await expect(pub.getByRole("heading", { level: 1, name: "Luma Reyes" })).toBeVisible();
});

test("E5: Home zeigt die eigene Seite mit Status und führt in den Editor", async ({ page }) => {
  await liveProfile(page, "Marlon Weiss");
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: "Hi Marlon." })).toBeVisible();
  await expect(page.getByTestId("page-status")).toContainText("Up to date");
  await expect(page.getByText("Start your first chain")).toBeVisible();
  await page.getByRole("link", { name: /edit my page/i }).click();
  await expect(page).toHaveURL(/\/edit$/);
});

test("E6: Mit eigener Seite führt /start in den Editor; Abmelden geht im Editor", async ({ page }) => {
  await liveProfile(page);
  await page.goto("/start");
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/edit");
  await expect(page).toHaveURL(/\/login\?next=/);
});
