import { expect, test, type Page } from "@playwright/test";

// Labor „Deck“ (/lab/deck): sichtbarer offizieller Player, Cue-Punkte, Spulen.
// YouTube und SoundCloud werden durch Attrappen ihrer offiziellen Schnittstellen ersetzt,
// damit die Tests nicht vom Netz abhängen. Echte Wiedergabe prüft der PO in der Vercel-Vorschau.

const EXTERNAL = /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|bandcamp\.com|bcbits\.com|soundcloud\.com|sndcdn\.com/;

// Attrappe der YouTube IFrame API: legt ein sichtbares iframe an und merkt sich alle Aufrufe.
const YT_STUB = `
window.__yt = { calls: [], t: 0 };
window.YT = { PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  Player: function (el, opts) {
    var f = document.createElement('iframe');
    f.setAttribute('data-testid', 'yt-frame');
    f.setAttribute('title', 'YouTube player');
    f.style.width = '100%'; f.style.height = '100%'; f.style.border = '0'; f.style.background = '#000';
    el.replaceWith(f);
    var s = window.__yt, ev = opts.events || {};
    var emit = function (state) { s.state = state; ev.onStateChange && ev.onStateChange({ data: state }); };
    s.calls.push(['create', opts.videoId, (opts.playerVars || {}).start || 0]);
    s.t = (opts.playerVars || {}).start || 0;
    this.playVideo = function () { s.calls.push(['playVideo']); emit(1); };
    this.pauseVideo = function () { s.calls.push(['pauseVideo']); emit(2); };
    this.seekTo = function (sec) { s.calls.push(['seekTo', Math.round(sec)]); s.t = sec; };
    this.loadVideoById = function (o) { s.calls.push(['loadVideoById', o.videoId, o.startSeconds || 0]); s.t = o.startSeconds || 0; emit(1); };
    this.getCurrentTime = function () { return s.t; };
    this.getDuration = function () { return 400; };
    this.getPlayerState = function () { return s.state; };
    this.destroy = function () {};
    var self = this;
    setTimeout(function () { ev.onReady && ev.onReady({ target: self }); }, 0);
  } };
setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 0);
`;

async function setup(page: Page) {
  const hits: string[] = [];
  await page.route(EXTERNAL, async (route) => {
    const url = route.request().url();
    hits.push(url);
    if (url.includes("/iframe_api")) return route.fulfill({ contentType: "text/javascript", body: YT_STUB });
    return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>stub</title>" });
  });
  await page.goto("/lab/deck");
  await expect(page.getByRole("heading", { name: "Baptiste" })).toBeVisible();
  return hits;
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __yt?: { calls: unknown[][] } }).__yt?.calls ?? []);

test("vor der Einwilligung geht keine Anfrage an YouTube, Bandcamp oder SoundCloud", async ({ page }) => {
  const hits = await setup(page);
  await page.getByRole("button", { name: "Play the crate" }).click();
  await expect(page.getByText(/This loads the YouTube player/)).toBeVisible();
  await page.waitForTimeout(500);
  expect(hits).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("nach der Einwilligung ist der offizielle Player sichtbar und startet am Cue", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Play the crate" }).click();
  await page.getByRole("button", { name: "Allow and load the player" }).click();
  const frame = page.getByTestId("yt-frame");
  await expect(frame).toBeVisible();
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(200);
  expect(box!.height).toBeGreaterThanOrEqual(200);
  // nichts liegt über dem Player
  const onTop = await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y) as HTMLElement | null)?.dataset.testid, {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  });
  expect(onTop).toBe("yt-frame");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const c = await calls(page);
  expect(c[0][0]).toBe("create");
  expect(c[0][2]).toBeGreaterThan(0); // Start am Cue, nicht bei 0:00
});

test("Spulen und Cue steuern den echten Player", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Play the crate" }).click();
  await page.getByRole("button", { name: "Allow and load the player" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const cue = (await calls(page))[0][2] as number;
  await page.getByRole("button", { name: "Forward 30 seconds" }).click();
  await page.getByRole("button", { name: "Back 15 seconds" }).click();
  await page.getByRole("button", { name: /^Jump to cue/ }).click();
  const seeks = (await calls(page)).filter((x) => x[0] === "seekTo").map((x) => x[1]);
  expect(seeks).toEqual([cue + 30, cue + 15, cue]);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("Blättern während der Wiedergabe legt die nächste Platte am Cue auf", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Play the crate" }).click();
  await page.getByRole("button", { name: "Allow and load the player" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const first = (await calls(page))[0][1];
  await page.getByRole("button", { name: "Next record" }).click();
  await expect.poll(async () => (await calls(page)).some((x) => x[0] === "loadVideoById" && x[1] !== first)).toBe(true);
});

test("Bandcamp: offizielles Embed sichtbar, eigene Knöpfe gesperrt", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Previous record" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: "All Nite / Feeling Free" })).toBeVisible();
  await page.getByRole("button", { name: "Play the crate" }).click();
  await expect(page.getByText(/This loads the Bandcamp player/)).toBeVisible();
  await page.getByRole("button", { name: "Allow and load the player" }).click();
  await expect(page.locator('iframe[src^="https://bandcamp.com/EmbeddedPlayer/album=4186565524/"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Forward 30 seconds" })).toBeDisabled();
  await expect(page.getByText(/Use its own play button/)).toBeVisible();
});

test("reduzierte Bewegung: die Platte dreht sich nicht", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.getByRole("button", { name: "Play the crate" }).click();
  await page.getByRole("button", { name: "Allow and load the player" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const anim = await page.getByTestId("disc-spin").evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe("none");
});
