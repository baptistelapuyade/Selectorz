import { expect, test, type Page } from "@playwright/test";
import { asUser, completedChain, fresh, liveProfileUser, login, userId } from "./helpers";

// Abnahme M2 Teil 2a: Abschluss, gemeinsame Freigabe, öffentliche Selection, Story.
// Video und Screenshots dieses Ablaufs landen in der CI als Artefakt „abnahme“ (zum Anschauen statt Nachklicken).
test.use({ video: "on" });

// Neue Browser-Kontexte mit denselben Geräte-Einstellungen wie das Projekt (mobil/Desktop)
const ctx = (info: { project: { use: Record<string, unknown> } }, extra = {}) => {
  const u = info.project.use;
  return { baseURL: u.baseURL as string, viewport: u.viewport as { width: number; height: number }, isMobile: u.isMobile as boolean, hasTouch: u.hasTouch as boolean, userAgent: u.userAgent as string, deviceScaleFactor: u.deviceScaleFactor as number, ...extra };
};

const shot = (page: Page, name: string, fullPage = true) =>
  page.screenshot({ path: `test-results/abnahme/${test.info().project.name}-${name}.png`, fullPage });

test("F1: Abschluss, erst beide Freigaben machen die Selection öffentlich, Widerruf nimmt sie zurück", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const luma = await liveProfileUser(page, "Luma Reyes");
  const kofiCtx = await browser.newContext(ctx(info, { recordVideo: { dir: info.outputPath("kofi") } }));
  const kofi = await kofiCtx.newPage();
  const kofiMail = fresh("kofi");
  await login(kofi, kofiMail);
  const kofiId = await userId(kofiMail);
  await asUser(kofiId, (q) => q("update public.accounts set display_name = 'Kofi Mensah' where id = $1", [kofiId]));
  const chain = await completedChain(luma.uid, kofiId);
  const anon = await browser.newContext(ctx(info));
  const visitor = await anon.newPage();

  // Luma: Abschluss-Moment, dann Freigabe
  await page.goto(`/chain/${chain}`);
  await expect(page.getByRole("heading", { name: "Your selection is complete." })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#pub-title")).toHaveText("Show it publicly?");
  await page.waitForTimeout(6500); // Animation einmal ganz durchlaufen lassen (fürs Video)
  await shot(page, "1-abschluss");
  await page.getByRole("button", { name: "Approve and make a story" }).click();
  await expect(page.locator("#pub-title")).toHaveText("Waiting for Kofi’s yes.");
  await expect(page.getByLabel("1 of 2 said yes").filter({ visible: true })).toBeVisible();

  // Mit nur einer Freigabe: nichts öffentlich
  await visitor.goto(`/s/${chain}`);
  await expect(visitor.getByRole("heading", { name: /No page/ })).toBeVisible();
  await visitor.goto(`/${luma.handle}`);
  await expect(visitor.getByTestId("profile-selection")).toHaveCount(0);

  // Kofi: Home zeigt „Needs a yes“, dann Freigabe; Story öffnet sich
  await kofi.goto("/home");
  await expect(kofi.getByTestId("round-row").filter({ hasText: "Slow Sunday" })).toContainText("Needs a yes");
  await kofi.goto(`/chain/${chain}`);
  await expect(kofi.locator("#pub-title")).toHaveText("Show it publicly? Luma said yes.");
  await kofi.getByRole("button", { name: "Approve and make a story" }).click();
  const dialog = kofi.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Share your selection." })).toBeVisible();
  await expect(dialog.getByRole("img", { name: /Your selection story, bands/ })).toBeVisible();
  await dialog.getByRole("tab", { name: "Poster" }).click();
  await expect(dialog.getByRole("img", { name: /Your selection story, poster/ })).toBeVisible();
  if (info.project.name === "desktop") {
    const download = kofi.waitForEvent("download");
    await dialog.getByRole("button", { name: "Save image only" }).click();
    expect((await download).suggestedFilename()).toBe("selectorz-selection-poster.png");
  }
  await shot(kofi, "2-story");
  await dialog.getByRole("button", { name: "Close ✕" }).click();
  await expect(kofi.locator("#pub-title")).toHaveText("It’s public.");

  // Öffentlich: Selection-Seite ausgeloggt lesbar, Profil zeigt die Karte
  await visitor.goto(`/s/${chain}`);
  await expect(visitor.getByRole("heading", { name: "Slow Sunday", level: 1 })).toBeVisible();
  for (let n = 1; n <= 6; n++) await expect(visitor.getByTestId(`sel-entry-${n}`)).toBeVisible();
  await expect(visitor.getByTestId("sel-entry-1")).toContainText("LUMA PICKED");
  await expect(visitor.getByTestId("sel-entry-2")).toContainText("KOFI ANSWERED");
  await expect(visitor.getByRole("link", { name: "View profile →" })).toHaveAttribute("href", `/${luma.handle}`);
  await expect(visitor.getByText("No public page yet")).toBeVisible();
  await expect(visitor.getByRole("button", { name: /play all/i })).toHaveCount(0);
  await shot(visitor, "3-selection-seite");
  await visitor.goto(`/${luma.handle}`);
  await expect(visitor.getByTestId("profile-selection")).toContainText("Slow Sunday");
  await visitor.getByTestId("profile-selection").scrollIntoViewIfNeeded();
  await shot(visitor, "4-profil", false); // ganze Seite wird mobil leer aufgenommen (Profil-Layout), daher Ausschnitt

  // Luma nimmt das Ja zurück: Seite und Karte sind weg, Profil bleibt
  await page.reload();
  await expect(page.locator("#pub-title")).toHaveText("It’s public.");
  await page.getByRole("button", { name: "Take back my yes" }).click();
  await expect(page.locator("#pub-title")).toHaveText("Show it publicly? Kofi said yes.");
  await visitor.goto(`/s/${chain}`);
  await expect(visitor.getByRole("heading", { name: /No page/ })).toBeVisible();
  await visitor.goto(`/${luma.handle}`);
  await expect(visitor.getByRole("heading", { name: "Luma Reyes" }).first()).toBeVisible();
  await expect(visitor.getByTestId("profile-selection")).toHaveCount(0);

  // Zweites Öffnen: Abschluss ohne Animation
  await page.reload();
  await expect(page.locator(".done-seen")).toHaveCount(1);
  await kofiCtx.close();
  await anon.close();
});

test("F2: Fremde sehen die Kette nicht, die Seite einer unfertigen Kette gibt nichts preis", async ({ page, browser }, info) => {
  const luma = await liveProfileUser(page, "Luma Reyes");
  const { chain_id } = await asUser(luma.uid, (q) =>
    q("select * from public.start_chain('Secret Title', 'https://soundcloud.com/e2e/x-' || gen_random_uuid(), 'One', '', '', gen_random_uuid())"),
  ).then((r) => r.rows[0]);
  const anon = await browser.newContext(ctx(info));
  const v = await anon.newPage();
  await v.goto(`/s/${chain_id}`);
  await expect(v.getByRole("heading", { name: /No page/ })).toBeVisible();
  await expect(v).toHaveTitle(/No page here/);
  expect(await v.content()).not.toContain("Secret Title");
  await anon.close();
});

test("F3: Name gemeinsam: Vorschlag gilt erst nach Zustimmung, öffentliche Selection zeigt den neuen Namen (PO 27.11.)", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const luma = await liveProfileUser(page, "Luma Reyes");
  const kofiCtx = await browser.newContext(ctx(info));
  const kofi = await kofiCtx.newPage();
  const kofiMail = fresh("kofi");
  await login(kofi, kofiMail);
  const kofiId = await userId(kofiMail);
  await asUser(kofiId, (q) => q("update public.accounts set display_name = 'Kofi Mensah' where id = $1", [kofiId]));
  const chain = await completedChain(luma.uid, kofiId);
  const name = (p: Page) => p.getByTestId("name-it").filter({ visible: true });
  const sleeve = (p: Page, t: string) => p.getByRole("img", { name: `${t}, a selection by Luma × Kofi` });

  // Beide geben frei, damit die öffentliche Seite den Namen zeigt
  await page.goto(`/chain/${chain}`);
  await page.getByRole("button", { name: "Approve and make a story" }).click();
  await expect(page.locator("#pub-title")).toHaveText("Waiting for Kofi’s yes.");
  await kofi.goto(`/chain/${chain}`);
  await kofi.getByRole("button", { name: "Approve and make a story" }).click();
  await expect(kofi.getByRole("dialog")).toBeVisible();
  await kofi.keyboard.press("Escape");

  // Startname ist Lumas Vorschlag: Luma wartet, Kofi sieht „Luma suggests“
  await page.reload();
  await expect(name(page)).toHaveAttribute("data-state", "B");
  await expect(name(kofi)).toHaveAttribute("data-state", "A");
  await expect(name(kofi)).toContainText("Luma suggests");

  // Luma schlägt etwas Neues vor: gültig bleibt „Slow Sunday“
  await name(page).getByRole("button", { name: "Change" }).click();
  await name(page).getByRole("textbox").fill("Sunday Glow");
  await name(page).getByRole("button", { name: "Suggest" }).click();
  await expect(name(page)).toHaveAttribute("data-state", "B");
  await expect(name(page)).toContainText("Sunday Glow");
  await expect(sleeve(page, "Slow Sunday")).toBeVisible();

  // Kofi stimmt zu: beide sehen „Named together“, Hülle und öffentliche Seite den neuen Namen
  await kofi.reload();
  await expect(name(kofi)).toHaveAttribute("data-state", "A");
  await expect(name(kofi)).toContainText("Sunday Glow");
  await name(kofi).getByRole("button", { name: "Sounds good" }).click();
  await expect(name(kofi)).toHaveAttribute("data-state", "C");
  await expect(sleeve(kofi, "Sunday Glow")).toBeVisible();
  await page.reload();
  await expect(name(page)).toHaveAttribute("data-state", "C");
  await expect(name(page)).toContainText("Named together");
  const anon = await browser.newContext(ctx(info));
  const visitor = await anon.newPage();
  await visitor.goto(`/s/${chain}`);
  await expect(visitor.getByRole("heading", { name: "Sunday Glow", level: 1 })).toBeVisible();
  await visitor.goto(`/${luma.handle}`);
  await expect(visitor.getByTestId("profile-selection")).toContainText("Sunday Glow");
  await shot(kofi, "name-together");
  await anon.close();
  await kofiCtx.close();
});

test("F4: Story später wiederfinden: Share-Menü auf der Selection-Seite und „Make a story“ auf Home (PO 27.11.)", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const luma = await liveProfileUser(page, "Luma Reyes");
  const kofiCtx = await browser.newContext(ctx(info));
  const kofi = await kofiCtx.newPage();
  const kofiMail = fresh("kofi");
  await login(kofi, kofiMail);
  const kofiId = await userId(kofiMail);
  await asUser(kofiId, (q) => q("update public.accounts set display_name = 'Kofi Mensah' where id = $1", [kofiId]));
  const chain = await completedChain(luma.uid, kofiId);
  await kofi.goto(`/chain/${chain}`);
  await kofi.getByRole("button", { name: "Approve and make a story" }).click();
  await page.goto(`/chain/${chain}`);
  await page.getByRole("button", { name: "Approve and make a story" }).click();
  // Story wegklicken: danach soll sie trotzdem wieder erreichbar sein
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Selection-Seite: Beteiligte bekommen ein Menü mit „Make a story“
  await page.goto(`/s/${chain}`);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("menuitem", { name: /Copy link/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Make a story/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, "share-story-selection");
  await page.keyboard.press("Escape");

  // Home: öffentliche Runde mit „Make a story“ führt direkt in die Story (Aktion nur am Desktop, Board M1cHomeRounds2)
  if (info.project.name === "desktop") {
  await page.goto("/home");
  const row = page.getByTestId("round-row").filter({ hasText: "Slow Sunday" });
  await expect(row).toContainText("Public");
  await page.getByRole("link", { name: "Make a story" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${chain}`));
  await expect(page.getByRole("dialog")).toBeVisible();
  }

  // Fremde: kein Menü, nur Link
  const anon = await browser.newContext(ctx(info));
  const visitor = await anon.newPage();
  await visitor.goto(`/s/${chain}`);
  await visitor.getByRole("button", { name: "Share" }).click();
  await expect(visitor.getByRole("menuitem", { name: /Make a story/ })).toHaveCount(0);
  await visitor.goto(`/s/${chain}?story=1`);
  await expect(visitor.getByRole("dialog")).toHaveCount(0);
  await anon.close();
  await kofiCtx.close();
});
