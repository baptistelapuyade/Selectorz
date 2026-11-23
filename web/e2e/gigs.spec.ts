import { expect, test, type Page } from "@playwright/test";
import { db, fresh, login, userId } from "./helpers";

// Abnahme „Next gigs“ (Briefing vom 23.11.2026): eintragen, sofort live, ändern, löschen mit Undo, Story.

export async function liveProfile(page: Page, name = "Luma Reyes") {
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


const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function addGig(page: Page, date: string, event: string, url = "") {
  const form = page.getByRole("form", { name: "Add a gig" });
  await form.getByLabel("Date").fill(date);
  await form.getByLabel("Event or club").fill(event);
  await form.getByLabel(/^Link/).fill(url);
  await form.getByRole("button", { name: "Add gig" }).click();
}

test("G1: Gig eintragen geht sofort live, mit Link-Beschriftung; Stadt kommt aus „Based“", async ({ page, context }) => {
  const handle = await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "+ Add gig" }).click();
  await expect(page.getByRole("form", { name: "Add a gig" }).getByLabel("City")).toHaveValue("Berlin");
  await addGig(page, inDays(4), "Late Hours at Kiez Klub", "ra.co/events/2214");
  await expect(page.getByText(/It's on your page now/)).toBeVisible();

  const pub = await context.newPage();
  await pub.goto(`/${handle}`);
  await expect(pub.getByRole("heading", { name: "Next gigs" })).toBeVisible();
  await expect(pub.getByText("Late Hours at Kiez Klub")).toBeVisible();
  await expect(pub.getByRole("link", { name: /RA/ })).toHaveAttribute("href", "https://ra.co/events/2214");
});

test("G2: Ungültiger Link wird freundlich markiert, nichts wird gespeichert", async ({ page }) => {
  await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "+ Add gig" }).click();
  await addGig(page, inDays(2), "Haus der Platten", "ra.co events 2214");
  await expect(page.getByText(/That link doesn't open/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Coming up" }).getByRole("listitem")).toHaveCount(0);
});

test("G3: Gig verschieben, löschen mit Undo; ohne kommende Gigs kein Modul auf der Seite", async ({ page, context }) => {
  const handle = await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "+ Add gig" }).click();
  await addGig(page, inDays(5), "Rooftop Hours");
  await expect(page.getByText(/It's on your page now/)).toBeVisible();

  await page.getByRole("button", { name: "Edit Rooftop Hours" }).click();
  const edit = page.getByRole("form", { name: "Edit gig" });
  await edit.getByLabel("Date").fill(inDays(9));
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved\. Live on your page now/)).toBeVisible();

  await page.getByRole("button", { name: "Delete Rooftop Hours" }).click();
  await expect(page.getByText("Gig removed.")).toBeVisible();
  const pub = await context.newPage();
  await pub.goto(`/${handle}`);
  await expect(pub.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(pub.getByRole("heading", { name: "Next gigs" })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("list", { name: "Coming up" })).toContainText("Rooftop Hours");
  await pub.reload();
  await expect(pub.getByText("Rooftop Hours")).toBeVisible();
});

test("G4: Story aus einem Gig: 1080 × 1920, Teilen-Knopf bereit", async ({ page }) => {
  await liveProfile(page);
  await page.goto("/edit");
  await page.getByRole("button", { name: "+ Add gig" }).click();
  await addGig(page, inDays(3), "Slow Dance");
  await page.getByRole("button", { name: "Make a story →" }).click();
  const img = page.getByRole("img", { name: "Your gig story" });
  await expect(img).toBeVisible({ timeout: 15_000 });
  const size = await img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]);
  expect(size).toEqual([1080, 1920]);
  await expect(page.getByRole("button", { name: /share story/i })).toBeEnabled();
});
