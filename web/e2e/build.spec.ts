import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { db, fresh } from "./helpers";
import { latestCode } from "./mailpit";

// Abnahme M1b „Profil erstellen“ (Plan vom 20.11.2026; PRD 22 A1, A2, A5, C20, D23, D24; PROFILE-01/02/04/10).
// Metadaten kommen in der CI aus einer Attrappe (OEMBED_FAKE=1): Titel aus dem letzten Pfadteil, Name aus dem ersten;
// Links mit „fail“ im Pfad scheitern absichtlich.

const PORTRAIT = readFileSync(join(__dirname, "fixtures", "portrait.jpg"));
const tag = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function noHorizontalScroll(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
}

async function pasteLink(page: Page, url: string) {
  await page.goto("/start");
  await page.getByLabel("Your SoundCloud link").fill(url);
  await page.getByLabel("Your SoundCloud link").blur();
}

async function setNameAndHandle(page: Page, name: string, handle: string) {
  await page.getByLabel("DJ name").fill(name);
  await page.getByLabel("Your page address").fill(handle);
  await expect(page.getByText("Available")).toBeVisible();
}

async function addSound(page: Page, genre = "Deep House") {
  await page.getByRole("button", { name: /add your sound/i }).first().click();
  const sheet = page.getByRole("dialog", { name: "Your sound" });
  await sheet.getByPlaceholder("Search genres").fill(genre.split(" ")[0]);
  await sheet.getByRole("checkbox", { name: genre, exact: true }).check();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
}

async function addPhoto(page: Page, style: "dots" | "bw" = "dots") {
  await page.getByRole("button", { name: /add (your )?photo/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Your photo" });
  await dialog.getByLabel("Choose a photo").setInputFiles({ name: "portrait.jpg", mimeType: "image/jpeg", buffer: PORTRAIT });
  await expect(dialog.getByRole("img", { name: /halftone preview/i })).toBeVisible();
  if (style === "bw") {
    await dialog.getByRole("radio", { name: "Black and white" }).click();
    await expect(dialog.getByRole("img", { name: /black and white preview/i })).toBeVisible();
  }
  await dialog.getByRole("button", { name: /use this photo/i }).click();
  await expect(dialog).toBeHidden();
}

async function goLive(page: Page, email = fresh("build")) {
  await page.getByRole("button", { name: /save my page/i }).click();
  const sheet = page.getByRole("dialog", { name: /one last step/i });
  await sheet.getByLabel("Email").fill(email);
  const sentAt = Date.now();
  await sheet.getByRole("button", { name: /send me a code/i }).click();
  await sheet.getByLabel("6-digit code").fill(await latestCode(email, sentAt));
  await sheet.getByRole("button", { name: /go live/i }).click();
  await expect(page.getByRole("heading", { name: /you're live/i })).toBeVisible({ timeout: 20_000 });
  return email;
}

async function readAsVisitor(page: Page, handle: string) {
  const visitor = await page.context().browser()!.newContext();
  const v = await visitor.newPage();
  await v.goto(`/${handle}`);
  return { v, close: () => visitor.close() };
}

test("1 · Eigener SoundCloud-Link bis live; danach ausgeloggt lesbar (A1, D24)", async ({ page }) => {
  const t = tag();
  const handle = `luma${t}`;
  const bodies: Buffer[] = [];
  page.on("request", (r) => {
    const b = r.postDataBuffer();
    if (b) bodies.push(b);
  });

  const started = Date.now();
  await pasteLink(page, `https://soundcloud.com/luma-reyes/late-hours-${t}`);
  await expect(page.getByText(`Late Hours ${t}`, { exact: false }).first()).toBeVisible();
  expect(Date.now() - started).toBeLessThan(5_000); // erste Vorschau in wenigen Sekunden
  await expect(page.getByText(/Your DJ name/)).toContainText("Luma Reyes"); // Vorschlag aus dem Uploader-Namen
  await page.getByRole("button", { name: /make my page/i }).click();

  await expect(page.getByRole("heading", { name: /here's your first version/i })).toBeVisible();
  await setNameAndHandle(page, `Luma ${t}`, handle);
  await page.getByLabel("Based").fill("Berlin");
  await page.getByText("Vinyl", { exact: true }).click(); // Chip = Label um eine versteckte Checkbox
  await expect(page.getByRole("checkbox", { name: "Vinyl", exact: true })).toBeChecked();
  await addSound(page);
  await addPhoto(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await goLive(page);

  // „You're live“: Link kopieren mit Bestätigung, Story-Karte 1080 × 1920 (SHARE-02, SHARE-07)
  await expect(page.getByText(`selectorz.art/${handle}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://selectorz.art/${handle}`);
  const card = page.getByRole("img", { name: "Your story card" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  expect(await card.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1080, 1920]);
  await expect(page.getByRole("button", { name: "Share story" })).toBeEnabled();
  await expect(page.getByRole("link", { name: /view my page/i })).toHaveAttribute("href", `/${handle}`);

  // Das Originalfoto hat den Browser nie verlassen: kein Request enthält die JPEG-Bytes.
  const signature = PORTRAIT.subarray(0, 64);
  expect(bodies.some((b) => b.includes(signature))).toBe(false);

  const { v, close } = await readAsVisitor(page, handle);
  await expect(v.getByRole("heading", { level: 1 })).toHaveText(`Luma ${t}`);
  await expect(v.getByText("My sound")).toBeVisible();
  await expect(v.getByText(`Late Hours ${t}`, { exact: false }).first()).toBeVisible();
  await expect(v.getByText("Deep House").first()).toBeVisible();
  await expect(v.getByText("Berlin").first()).toBeVisible();
  await close();

  const { rows } = await db.query(
    "select p.status, o.name from public.profiles p join storage.objects o on o.name = p.published->>'photo_path' and o.bucket_id = 'avatars' where p.handle = $1",
    [handle],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("published");
  expect(rows[0].name).toMatch(/\.png$/);
  // Raster: daneben die Night-Maske (Punkte für Licht), damit ein Look-Wechsel kein neues Foto braucht
  const night = await db.query("select 1 from storage.objects where bucket_id = 'avatars' and name = $1", [rows[0].name.replace(/\.png$/, "-night.png")]);
  expect(night.rowCount).toBe(1);
});

test("2 · Pflichtangaben fehlen: klare Meldung, nichts geht verloren (A2)", async ({ page }) => {
  const t = tag();
  await pasteLink(page, `https://soundcloud.com/kofi/sunday-${t}`);
  await page.getByRole("button", { name: /make my page/i }).click();
  await setNameAndHandle(page, `Kofi ${t}`, `kofi${t}`);
  await page.getByRole("button", { name: /save my page/i }).click();
  await expect(page.getByText(/add a photo and your sound first/i)).toBeVisible();
  await expect(page.getByRole("dialog", { name: /one last step/i })).toBeHidden();

  // Neu laden: Entwurf ist noch da (liegt bis zum Login im Browser).
  await page.reload();
  await expect(page.getByLabel("DJ name")).toHaveValue(`Kofi ${t}`);
  await expect(page.getByLabel("Your page address")).toHaveValue(`kofi${t}`);
  await expect(page.getByText(`Sunday ${t}`, { exact: false }).first()).toBeVisible();
});

test("3 · Abruf scheitert: Titel und Artist von Hand, Link bleibt (A5)", async ({ page }) => {
  const t = tag();
  const handle = `mira${t}`;
  await pasteLink(page, `https://soundcloud.com/mira/fail-${t}`);
  await expect(page.getByText(/couldn't read that link/i)).toBeVisible();
  await page.getByLabel("Title").fill(`Hand Typed ${t}`);
  await page.getByLabel("Artist").fill("Mira K");
  await page.getByRole("button", { name: /make my page/i }).click();
  await setNameAndHandle(page, `Mira ${t}`, handle);
  await addSound(page, "Dub Techno");
  await addPhoto(page, "bw"); // Schwarz-Weiß statt Raster (PRD 14.11)
  await goLive(page);

  const { v, close } = await readAsVisitor(page, handle);
  await expect(v.getByText(`Hand Typed ${t}`).first()).toBeVisible();
  await expect(v.getByRole("img", { name: /black and white portrait/i })).toBeVisible();
  await close();
  const { rows } = await db.query("select published->>'photo_style' as style from public.profiles where handle = $1", [handle]);
  expect(rows[0].style).toBe("bw");
});

test("4 · Ohne eigenen Mix: Tracks you love werden Set openers", async ({ page }) => {
  const t = tag();
  const handle = `teo${t}`;
  await page.goto("/start");
  await page.getByRole("button", { name: /start with tracks/i }).click();
  await expect(page.getByRole("heading", { name: /start with tracks you love/i })).toBeVisible();
  await page.getByLabel("Track 1").fill(`https://soundcloud.com/halden/ostkreuz-dub-${t}`);
  await page.getByLabel("Track 1").blur();
  await expect(page.getByText(`Ostkreuz Dub ${t}`, { exact: false }).first()).toBeVisible();
  // Bandcamp hat kein oEmbed: Titel und Artist von Hand
  await page.getByLabel("Track 2").fill(`https://teodora.bandcamp.com/track/glass-floor-${t}`);
  await page.getByLabel("Track 2").blur();
  await page.getByLabel("Title of track 2").fill("Glass Floor");
  await page.getByLabel("Artist of track 2").fill("Teodora");
  await page.getByLabel("Your DJ name").fill(`Teo ${t}`);
  await page.getByRole("button", { name: /make my page/i }).click();

  await setNameAndHandle(page, `Teo ${t}`, handle);
  await page.getByRole("radio", { name: "Night" }).click();
  await page.getByRole("radio", { name: "Cyan" }).click(); // Akzentfarbe aus der Night-Palette (PROFILE-11)
  await addSound(page, "Disco");
  await addPhoto(page);
  await goLive(page);

  const { v, close } = await readAsVisitor(page, handle);
  // Night: Akzent-Punkte für Licht auf Schwarz (eigene Maske), kein Negativ
  const mask = await v.getByRole("img", { name: /halftone portrait/i }).evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
  expect(mask).toContain("-night.");
  const acc = await db.query("select published->>'accent' as accent from public.profiles where handle = $1", [handle]);
  expect(acc.rows[0].accent).toBe("#3FD0E0");
  await expect(v.getByRole("img", { name: /halftone portrait/i })).toHaveCSS("background-color", "rgb(63, 208, 224)");
  await expect(v.getByText("Set openers")).toBeVisible();
  await expect(v.getByText("Glass Floor")).toBeVisible();
  await expect(v.getByText(`Ostkreuz Dub ${t}`, { exact: false }).first()).toBeVisible();
  await close();
});

test("5 · Vergebenes oder reserviertes Handle: Meldung schon beim Tippen (PROFILE-01)", async ({ page }) => {
  const t = tag();
  const taken = `taken${t}`;
  const { rows } = await db.query("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [fresh("taken")]);
  await db.query("insert into public.profiles (account_id, handle) values ($1, $2)", [rows[0].id, taken]);

  await pasteLink(page, `https://soundcloud.com/x/y-${t}`);
  await page.getByRole("button", { name: /make my page/i }).click();
  await page.getByLabel("Your page address").fill(taken);
  await expect(page.getByText(/already taken/i)).toBeVisible();
  await page.getByLabel("Your page address").fill("settings");
  await expect(page.getByText(/already taken|reserved/i)).toBeVisible();
  await page.getByLabel("Your page address").fill("a b");
  await expect(page.getByText(/letters/i)).toBeVisible();
});

test("6 · Mobil ohne seitliches Scrollen (C20)", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "nur mobil");
  await page.goto("/start");
  await noHorizontalScroll(page);
  await page.getByLabel("Your SoundCloud link").fill(`https://soundcloud.com/a-very-long-uploader-name-here/an-extremely-long-track-title-${tag()}`);
  await page.getByLabel("Your SoundCloud link").blur();
  await page.getByRole("button", { name: /make my page/i }).click();
  await page.getByLabel("DJ name").fill("Maximiliane Kowalczyk-Oyelaran");
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: /add your sound/i }).first().click();
  await noHorizontalScroll(page);
});

test("7 · Statistik: profile_published ohne Mail-Adresse und ohne Musik-Link", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_POSTHOG_HOST, "nur mit Test-Host");
  const events: string[] = [];
  await page.route(`${process.env.NEXT_PUBLIC_POSTHOG_HOST}/**`, async (route) => {
    events.push(route.request().postData() ?? "");
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const t = tag();
  const link = `https://soundcloud.com/ph/stat-${t}`;
  await pasteLink(page, link);
  await page.getByRole("button", { name: /make my page/i }).click();
  await setNameAndHandle(page, `Stat ${t}`, `stat${t}`);
  await addSound(page);
  await addPhoto(page);
  const email = await goLive(page);
  await expect.poll(() => events.join("\n"), { timeout: 15_000 }).toContain("profile_published");
  const all = events.join("\n");
  expect(all).not.toContain(email);
  expect(all).not.toContain(`stat-${t}`);
});

test("8 · Profil-Link statt Mix: klare Meldung, kein Profilname als Titel", async ({ page }) => {
  await pasteLink(page, "https://soundcloud.com/baptistelapuyade");
  await expect(page.getByText(/that's a profile link/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /make my page/i })).toBeDisabled();
});

test("9 · Farbe passt sich beim Look-Wechsel an: Day-Farbe bleibt nicht im Night-Look hängen", async ({ page }) => {
  await pasteLink(page, `https://soundcloud.com/c/colour-${tag()}`);
  await page.getByRole("button", { name: /make my page/i }).click();
  await page.getByRole("radio", { name: "Sun" }).click();
  await expect(page.getByRole("radio", { name: "Sun" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Night" }).click();
  await expect(page.getByRole("radio", { name: "Ember" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "Sun" })).toHaveCount(0);
});
