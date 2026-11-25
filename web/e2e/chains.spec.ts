import { expect, test, type Browser, type Page } from "@playwright/test";
import { latestCode } from "./mailpit";
import { fresh, liveProfile, login, turnHeading } from "./helpers";

// Abnahme M2 Teil 1 (Track-Ketten): starten, einladen, beitreten, abwechselnd bis sechs, Fehlerfälle.

const sc = (artist: string, title: string) => `https://soundcloud.com/${artist}/${title}-${Date.now()}`;

async function pickTrack(page: Page, n: number, url: string, comment = "") {
  const input = page.getByLabel(`Link of track ${n}`);
  await input.fill(url);
  await input.blur();
  await expect(page.getByText("Found", { exact: true })).toBeVisible();
  if (comment) await page.getByLabel(/Why this one\?/).fill(comment);
}

async function startChain(page: Page, title = "Slow Sunday") {
  await page.goto("/chain/new");
  await expect(page.getByRole("heading", { name: /Pick track 1/ })).toBeVisible();
  // Einladungskarte ist von Anfang an da (Board DeskChainStart3), Link erst nach dem Speichern
  await expect(page.getByRole("heading", { name: "Who plays track 2?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeDisabled();
  await pickTrack(page, 1, sc("halden", "ostkreuz-dub"), "To get us started.");
  await page.getByLabel(/Name this round/).fill(title);
  await page.getByRole("button", { name: "Save track 1" }).click();
  const link = page.getByLabel("Your invite link");
  await expect(link).toHaveValue(/\/invite\//);
  return link.inputValue();
}

// Neue Person ohne Konto: Einladung öffnen, Track 2 wählen, per Code einloggen, Namen angeben
async function joinAsNewcomer(browser: Browser, invite: string, track2 = sc("teodora", "glass-floor"), name = "Kofi Mensah") {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(invite);
  // Erster Blick wie Board DeskInvite, dann Track 2 wählen
  await expect(page.getByRole("heading", { name: "What would you play next?" })).toBeVisible();
  await expect(page.getByText("invited you to a track chain")).toBeVisible();
  await page.getByRole("button", { name: "Pick your track 2" }).click();
  await expect(page.getByRole("heading", { name: "Pick track 2." })).toBeVisible();
  await expect(page.getByText(/LUMA INVITED YOU/)).toBeVisible();
  await pickTrack(page, 2, track2, "Kept the dub, added a little shine.");
  await page.getByRole("button", { name: "Send track 2" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: /lock in your move/ })).toBeVisible();
  const email = fresh("join");
  await sheet.getByLabel("Email").fill(email);
  const sentAt = Date.now();
  await sheet.getByRole("button", { name: /send me a code/i }).click();
  await sheet.getByLabel("6-digit code").fill(await latestCode(email, sentAt));
  await sheet.getByRole("button", { name: "Lock in track 2" }).click();
  await expect(page.getByRole("heading", { name: /What should Luma call you/ })).toBeVisible();
  await page.getByLabel("DJ name").fill(name);
  await page.getByRole("button", { name: "Send track 2" }).last().click();
  await expect(page.getByRole("heading", { name: "Over to Luma." })).toBeVisible();
  return { ctx, page };
}

async function play(page: Page, n: number, artist: string, title: string) {
  await page.reload();
  await expect(page.getByRole("heading", { name: turnHeading(n) })).toBeVisible();
  await pickTrack(page, n, sc(artist, title));
  await page.getByRole("button", { name: `Send track ${n}` }).click();
  // erst weiter, wenn der Zug gespeichert ist (sonst lädt die andere Seite zu früh neu)
  await expect(page.getByRole("heading", { name: /^Over to |^Your selection is complete\.$/ })).toBeVisible();
}

test("K1: Kette von Track 1 bis 6 zwischen zwei DJs, Home zeigt Zug und Abschluss", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await liveProfile(page, "Luma Reyes");
  const invite = await startChain(page);
  expect(invite).toMatch(/\/invite\/[\w-]+$/);
  // Kopieren klappt auch ohne Zwischenablage-Berechtigung (Ausweg über markiertes Feld)
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await page.getByRole("link", { name: "Done, go to my rounds" }).click();
  await expect(page.getByTestId("round-row").filter({ hasText: "Slow Sunday" })).toContainText("Invite open");

  const kofi = await joinAsNewcomer(browser, invite);
  const chainUrl = kofi.page.url();

  // Luma ist dran: Home zeigt „Your turn“, die Runde zeigt Kofis Track groß
  await page.goto("/home");
  const card = page.getByTestId("round-turn").filter({ hasText: "Slow Sunday" });
  await expect(card).toContainText("Glass Floor");
  await expect(page.getByText("YOUR TURN", { exact: true })).toBeVisible();
  await card.getByRole("link", { name: /Pick track 3/ }).click();
  await expect(page.getByRole("heading", { name: turnHeading(3) })).toBeVisible();
  await expect(page.getByLabel("Kofi played")).toContainText("Kept the dub, added a little shine.");
  if (test.info().project.name === "desktop") await expect(page.getByText(/^KOFI ANSWERED · /)).toBeVisible();
  await expect(page.getByText("We email Kofi when it’s in. You can send the link yourself too.")).toBeVisible();

  await pickTrack(page, 3, sc("halden", "low-ceiling"));
  await page.getByRole("button", { name: "Send track 3" }).click();
  await expect(page.getByRole("heading", { name: "Over to Kofi." })).toBeVisible();
  await expect(page.getByText("We’ve emailed Kofi.", { exact: false })).toBeVisible();
  const mailMe = page.getByRole("switch", { name: "Email me" });
  await expect(mailMe).toHaveAttribute("aria-checked", "true");
  await mailMe.click();
  await expect(mailMe).toHaveAttribute("aria-checked", "false");
  await expect(mailMe).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Email me" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "Email me" }).click();
  await expect(page.getByRole("switch", { name: "Email me" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: "Email me" })).toBeEnabled();

  await play(kofi.page, 4, "ines", "harbour-lights");
  await expect(kofi.page.getByRole("heading", { name: "Over to Luma." })).toBeVisible();
  await play(page, 5, "theo", "warm-concrete");
  await play(kofi.page, 6, "sade", "basement-weather");
  await expect(kofi.page.getByRole("heading", { name: "Your selection is complete." })).toBeVisible();

  await page.goto(chainUrl);
  await expect(page.getByRole("heading", { name: "Your selection is complete." })).toBeVisible();
  await expect(page.getByText(/^6 OF 6 · (LUMA × KOFI|COMPLETE)$/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Slow Sunday, a selection by Luma × Kofi" })).toBeVisible();
  await page.goto("/home");
  await expect(page.getByTestId("round-row").filter({ hasText: "Slow Sunday" })).toContainText("Needs a yes");
  await kofi.ctx.close();
});

test("K2: Zweite Person kommt zu spät, ersetzter Link geht nicht mehr, eigener Link führt zur Runde", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await liveProfile(page, "Luma Reyes");
  const first = await startChain(page, "Late Train");

  // Neuer Link macht den alten ungültig
  await page.getByRole("button", { name: "Make a new link" }).click();
  await expect(page.getByLabel("Your invite link")).not.toHaveValue(first);
  const second = await page.getByLabel("Your invite link").inputValue();
  const anon = await browser.newContext();
  const a = await anon.newPage();
  await a.goto(first);
  await expect(a.getByRole("heading", { name: "This link doesn’t work anymore." })).toBeVisible();

  // Eigener Link: zur Runde, nicht beitreten
  await page.goto(second);
  await expect(page.getByRole("heading", { name: "Waiting for track 2." })).toBeVisible();

  const kofi = await joinAsNewcomer(browser, second);
  await a.goto(second);
  await expect(a.getByRole("heading", { name: "Someone got here first." })).toBeVisible();
  await expect(a.getByText("Luma and Kofi are already playing.", { exact: false })).toBeVisible();
  await anon.close();
  await kofi.ctx.close();
});

test("K3: Gleicher Track wird abgefangen, Runde beenden mit Bestätigung", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await liveProfile(page, "Luma Reyes");
  const invite = await startChain(page, "Rooftop Hours");
  const glass = sc("teodora", "glass-floor");
  const kofi = await joinAsNewcomer(browser, invite, glass);

  await page.goto(kofi.page.url());
  await expect(page.getByRole("heading", { name: turnHeading(3) })).toBeVisible();
  // Kofis Track noch einmal: Hinweis, Knopf bleibt aus
  await pickTrack(page, 3, glass);
  await expect(page.getByRole("alert").filter({ hasText: "already in this round" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send track 3" })).toBeDisabled();
  await page.getByRole("button", { name: "End this round" }).click();
  await page.getByRole("button", { name: "End round" }).click();
  await expect(page.getByRole("heading", { name: "You ended this round." })).toBeVisible();
  await kofi.page.reload();
  await expect(kofi.page.getByRole("heading", { name: "Luma ended this round." })).toBeVisible();
  await page.goto("/home");
  await page.getByRole("group", { name: "Filter rounds" }).getByRole("button", { name: /^All/ }).click();
  await expect(page.getByTestId("round-row").filter({ hasText: "Rooftop Hours" })).toContainText("Ended");
  await kofi.ctx.close();
});

test("K4: Zwei Tabs, ein Zug: der zweite Klick bekommt den aktuellen Stand", async ({ page, browser, context }) => {
  test.setTimeout(90_000);
  await liveProfile(page, "Luma Reyes");
  const invite = await startChain(page, "Two Tabs");
  const kofi = await joinAsNewcomer(browser, invite);
  const url = kofi.page.url();

  await page.goto(url);
  const tab2 = await context.newPage();
  await tab2.goto(url);
  await pickTrack(page, 3, sc("halden", "tab-one"));
  await pickTrack(tab2, 3, sc("halden", "tab-two"));
  await page.getByRole("button", { name: "Send track 3" }).click();
  await expect(page.getByRole("heading", { name: "Over to Kofi." })).toBeVisible();
  await tab2.getByRole("button", { name: "Send track 3" }).click();
  await expect(tab2.getByRole("alert").filter({ hasText: /not your turn|moved on/ })).toBeVisible();
  await tab2.getByRole("button", { name: "View the chain" }).click();
  await expect(tab2.getByTestId("entry-3")).toContainText("Tab One");
  await expect(tab2.getByTestId("entry-4")).toHaveCount(0);
  await kofi.ctx.close();
});

test("K6: Musik stoppt beim Verlassen der Runde (PO-Feedback 25.11.)", async ({ page }) => {
  test.setTimeout(60_000);
  await liveProfile(page, "Luma Reyes");
  const invite = await startChain(page, "Stop On Leave");
  await page.goto(invite);
  await expect(page.getByRole("heading", { name: "Waiting for track 2." })).toBeVisible();
  await page.getByRole("button", { name: /^Play / }).first().click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("link", { name: "Go to my rounds" }).click();
  await expect(page).toHaveURL(/\/home$/);
  // Next behält die alte Seite versteckt im DOM (Activity): der Player darf dort nicht weiterlaufen
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("K7: Home zeigt den neuen Zug ohne Neuladen (PO-Feedback 25.11.)", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await liveProfile(page, "Luma Reyes");
  const invite = await startChain(page, "Come Back Home");
  // Luma: Home, dann in die wartende Runde
  await page.getByRole("link", { name: "Done, go to my rounds" }).click();
  const row = page.getByTestId("round-row").filter({ hasText: "Come Back Home" });
  await expect(row).toContainText("Invite open");
  await row.click();
  await expect(page.getByRole("heading", { name: "Waiting for track 2." })).toBeVisible();
  // Kofi antwortet in einem anderen Browser
  const kofi = await joinAsNewcomer(browser, invite);
  // Luma geht über den Knopf zurück nach Home (Next zeigt die aufbewahrte Seite): Zug muss da sein
  await page.getByRole("link", { name: "Go to my rounds" }).click();
  await expect(page.getByTestId("round-turn").filter({ hasText: "Come Back Home" })).toBeVisible();
  await kofi.ctx.close();
});

test("K5: Kette starten braucht Login", async ({ page }) => {
  await page.goto("/chain/new");
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)chain(%2F|\/)new/);
  await login(page, fresh("chainlogin"), "/chain/new");
  await expect(page.getByRole("heading", { name: /Pick track 1/ })).toBeVisible();
});
