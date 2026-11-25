import { expect, test, type Page } from "@playwright/test";
import { asUser, fresh, liveProfileUser, login, turnHeading, userId } from "./helpers";
import { mailsTo, waitForMail } from "./mailpit";

// Abnahme M2 Teil 2b: Ketten-Mails. Mails landen in CI in Mailpit (MAIL_TRANSPORT=mailpit).
test.use({ video: "on" });

const ctx = (info: { project: { use: Record<string, unknown> } }, extra = {}) => {
  const u = info.project.use;
  return { baseURL: u.baseURL as string, viewport: u.viewport as { width: number; height: number }, isMobile: u.isMobile as boolean, hasTouch: u.hasTouch as boolean, userAgent: u.userAgent as string, deviceScaleFactor: u.deviceScaleFactor as number, ...extra };
};

async function pick(page: Page, n: number, slug: string) {
  const input = page.getByLabel(`Link of track ${n}`);
  await input.fill(`https://soundcloud.com/mail-test/${slug}-${Date.now()}`);
  await input.blur();
  await expect(page.getByText("Found", { exact: true })).toBeVisible();
}

test("N1: Zug-Mail nach jedem Zug, Button führt zur Kette, Doppelklick = eine Mail, abgeschaltet = keine Mail", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const luma = await liveProfileUser(page, "Luma Reyes");
  const { chain_id, invite_token } = await asUser(luma.uid, (q) =>
    q("select * from public.start_chain('Slow Sunday', 'https://soundcloud.com/mail-test/one-' || gen_random_uuid(), 'Ostkreuz Dub', 'Halden', '', gen_random_uuid())"),
  ).then((r) => r.rows[0]);

  // Kofi tritt über die Einladung bei
  const kofiCtx = await browser.newContext(ctx(info, { recordVideo: { dir: info.outputPath("kofi") } }));
  const kofi = await kofiCtx.newPage();
  const kofiMail = fresh("kofimail");
  await login(kofi, kofiMail);
  const kofiId = await userId(kofiMail);
  await asUser(kofiId, (q) => q("update public.accounts set display_name = 'Kofi Mensah' where id = $1", [kofiId]));
  await kofi.goto(`/invite/${invite_token}`);
  await kofi.getByRole("button", { name: "Pick your track 2" }).click();
  await pick(kofi, 2, "glass-floor");
  await kofi.getByRole("button", { name: "Send track 2" }).click();
  await expect(kofi.getByRole("heading", { name: "Over to Luma." })).toBeVisible();

  // Luma bekommt genau eine Zug-Mail mit Link zur Kette
  const m = await waitForMail(luma.email, /^Your turn: Kofi answered$/);
  expect(m.text).toContain("Track 3 is yours.");
  expect(m.text).not.toContain(kofiMail);
  const link = m.text.match(/Pick track 3: (\S+)/)![1];
  expect(link).toMatch(new RegExp(`/chain/${chain_id}$`));
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole("heading", { name: turnHeading(3) })).toBeVisible();
  await page.screenshot({ path: `test-results/abnahme/${info.project.name}-mail-2-kette-aus-mail.png` });
  // Die Mail selbst als Screenshot für die Abnahme
  const view = await kofiCtx.newPage();
  await view.setContent(m.html);
  await view.screenshot({ path: `test-results/abnahme/${info.project.name}-mail-1-zug-mail.png`, fullPage: true });
  await view.close();

  // Doppelklick auf „Send track 3“: Kofi bekommt genau eine Mail
  await pick(page, 3, "low-ceiling");
  await page.getByRole("button", { name: "Send track 3" }).dblclick();
  await expect(page.getByRole("heading", { name: "Over to Kofi." })).toBeVisible();
  await waitForMail(kofiMail, /^Your turn: Luma answered$/);
  await page.waitForTimeout(3000);
  expect((await mailsTo(kofiMail)).filter((x) => /Your turn/.test(x.Subject))).toHaveLength(1);

  // Kofi schaltet Ketten-Mails ab, spielt Track 4; Luma antwortet mit 5: keine weitere Mail an Kofi
  await kofi.goto("/settings");
  await kofi.getByLabel(/Track chain emails/).uncheck();
  await kofi.getByRole("button", { name: "Save" }).first().click();
  await kofi.waitForTimeout(1000);
  await kofi.goto(`/chain/${chain_id}`);
  await pick(kofi, 4, "harbour-lights");
  await kofi.getByRole("button", { name: "Send track 4" }).click();
  await expect.poll(async () => (await mailsTo(luma.email)).filter((x) => /^Your turn: Kofi answered$/.test(x.Subject)).length, { timeout: 20_000 }).toBe(2);
  await page.reload();
  await pick(page, 5, "warm-concrete");
  await page.getByRole("button", { name: "Send track 5" }).click();
  await expect(page.getByRole("heading", { name: "Over to Kofi." })).toBeVisible();
  await page.waitForTimeout(4000);
  expect((await mailsTo(kofiMail)).filter((x) => /Your turn/.test(x.Subject))).toHaveLength(1);
  await kofiCtx.close();
});
