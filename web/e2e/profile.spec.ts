import { expect, test, type Page } from "@playwright/test";
import { db, fresh, login, userId } from "./helpers";

// Abnahme M1a: öffentliches Profil (PRD 22 A1, A4, A6, C20, D23; PROFILE-07; MEDIA-07/09; TRUST-05)

type Opts = { name?: string; look?: "day" | "night"; status?: "published" | "withdrawn"; minimal?: boolean };

async function seedProfile(o: Opts = {}) {
  const email = fresh("prof");
  const handle = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const { rows } = await db.query("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
  const account = rows[0].id as string;
  const sc = "https://soundcloud.com/forss/flickermood";
  const published = {
    handle,
    display_name: o.name ?? "Luma Reyes",
    bio: o.minimal ? "" : "Long blends, sets that take their time.",
    city: o.minimal ? "" : "Berlin",
    genres: ["House"],
    plays: o.minimal ? [] : ["Vinyl"],
    look: o.look ?? "day",
    accent: o.look === "night" ? "#F0532A" : "#8C93FF",
    photo_path: null,
    links: o.minimal ? [] : [{ label: "Instagram", url: "https://instagram.com/" }],
    sections: o.minimal
      ? [{ kind: "mix", content: { mixes: [{ url: sc, title: "Only Mix" }] } }]
      : [
          { kind: "star_track", content: { track: { url: sc, title: "Ostkreuz Dub", artist: "Halden" } } },
          { kind: "set_openers", content: { tracks: [{ url: sc, title: "Morning Static", artist: "Tide Archive" }, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Paper Rooms", artist: "Okon" }] } },
        ],
  };
  const status = o.status ?? "published";
  const prof = await db.query(
    "insert into public.profiles (account_id, handle, status, published, published_at) values ($1, $2, $3, $4, now()) returning id",
    [account, handle, status, status === "published" ? published : null],
  );
  return { handle, account, profileId: prof.rows[0].id as string, email };
}

async function noHorizontalScroll(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
}

test("veröffentlichtes Profil ist ausgeloggt lesbar", async ({ page }) => {
  const { handle } = await seedProfile();
  await page.goto(`/${handle}`);
  await expect(page.getByRole("heading", { level: 1, name: "Luma Reyes" })).toBeVisible();
  await expect(page.getByText("Ostkreuz Dub")).toBeVisible();
  await expect(page.getByRole("link", { name: /instagram/i })).toHaveAttribute("href", "https://instagram.com/");
  await noHorizontalScroll(page);
});

for (const look of ["day", "night"] as const) {
  test(`minimales Profil mit langem Namen sieht im Look ${look} fertig aus`, async ({ page }) => {
    const { handle } = await seedProfile({ minimal: true, look, name: "Alexandria Konstantinopoulou-Westerhagen" });
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`/${handle}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/no photo/i)).toBeVisible();
    await expect(page.locator(`[data-look="${look}"]`)).toBeVisible();
    await noHorizontalScroll(page);
  });
}

test("zurückgezogen und nie vergeben sehen gleich aus: No page here", async ({ page }) => {
  const { handle } = await seedProfile({ status: "withdrawn" });
  const texts: string[] = [];
  for (const path of [`/${handle}`, "/nobody-here-123"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: /no page here/i })).toBeVisible();
    texts.push(await page.locator("main").innerText());
  }
  expect(texts[0]).toBe(texts[1]); // nicht erkennbar, dass es die Seite einmal gab
});

test("Player lädt erst nach Tippen und immer nur einer gleichzeitig", async ({ page }) => {
  await page.route("https://w.soundcloud.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>player</p>" }));
  await page.route("https://www.youtube-nocookie.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>player</p>" }));
  const { handle } = await seedProfile();
  await page.goto(`/${handle}`);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: /load player and play ostkreuz dub/i }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: /play paper rooms/i }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveAttribute("src", /youtube-nocookie/);
});

test("Melden: ohne Login Hinweis, mit Login landet die Meldung samt Blockierung", async ({ page }) => {
  const { handle, account, profileId } = await seedProfile();
  await page.goto(`/${handle}`);
  await page.getByRole("button", { name: "REPORT" }).click();
  await page.getByLabel("Spam or ads").check();
  await page.getByRole("button", { name: /send report/i }).click();
  await expect(page.getByRole("heading", { name: /log in to report/i })).toBeVisible();

  const reporter = fresh("reporter");
  await login(page, reporter, `/${handle}`);
  await page.getByRole("button", { name: "REPORT" }).click();
  await page.getByLabel("Pretends to be someone else").check();
  await page.getByLabel(/also block/i).check();
  await page.getByRole("button", { name: /send report/i }).click();
  await expect(page.getByRole("heading", { name: /we'll take a look/i })).toBeVisible();

  const me = await userId(reporter);
  const r = await db.query("select reason from public.reports where reporter_id = $1 and target_id = $2", [me, profileId]);
  expect(r.rows).toEqual([{ reason: "impersonation" }]);
  const b = await db.query("select 1 from public.blocks where blocker_id = $1 and blocked_id = $2", [me, account]);
  expect(b.rowCount).toBe(1);
});

test("Profilseite hat genau einen schwarzen Balken: Alpha + Feedback im Laufband", async ({ page }) => {
  const { handle } = await seedProfile();
  await page.goto(`/${handle}`);
  await expect(page.getByText("ALPHA", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Laufband ist ein endloser Loop: zwei gleiche Hälften, jede mindestens so breit wie der Bildschirm", async ({ page }) => {
  const { handle } = await seedProfile();
  await page.goto(`/${handle}`);
  const halves = page.locator("[data-marquee-half]");
  await expect(halves).toHaveCount(2);
  const [a, b] = await halves.evaluateAll((els) => els.map((e) => ({ text: e.textContent, width: e.getBoundingClientRect().width })));
  expect(a.text).toBe(b.text);
  expect(Math.abs(a.width - b.width)).toBeLessThan(1);
  const vw = await page.evaluate(() => window.innerWidth);
  expect(a.width).toBeGreaterThanOrEqual(vw - 1);
});
