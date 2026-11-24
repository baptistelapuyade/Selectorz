"use client";

import type { DraftPhoto } from "@/lib/build/draft";
import { SAFE, STORY_H, STORY_W, fitName, storyUrl } from "@/lib/story";

export type StoryData = {
  handle: string;
  displayName: string;
  genres: string[];
  plays: string[];
  look: "day" | "night";
  accent: string;
  photo: DraftPhoto | null;
};

const PAD = 54;
const TEXT_W = STORY_W - PAD * 2;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Bild wie object-fit: cover, Ausschnitt eher oben (Gesicht)
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, focusY = 0.3) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = Math.min(img.height - sh, Math.max(0, img.height * focusY - sh / 2));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Maske (schwarze Punkte, transparent) in einer Farbe einfärben
function tint(mask: HTMLImageElement, color: string) {
  const c = document.createElement("canvas");
  c.width = mask.width;
  c.height = mask.height;
  const x = c.getContext("2d")!;
  x.drawImage(mask, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function fonts() {
  const sans = getComputedStyle(document.body).fontFamily;
  const probe = document.createElement("span");
  probe.className = "font-mono";
  document.body.appendChild(probe);
  const mono = getComputedStyle(probe).fontFamily;
  probe.remove();
  return { sans, mono };
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// Profil-Story-Karte im Look der Person (SHARE-07/09/10/10a; Boards StoryProfHouse2B, StoryProfTechno2B)
export async function drawStory(d: StoryData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d")!;
  const f = fonts();
  // Schriften vorladen; schlägt das fehl (z. B. fehlende Ersatzschrift), mit dem Geladenen weitermachen
  await Promise.allSettled([
    ...["800 100px", "600 40px", "400 30px"].map((w) => document.fonts.load(`${w} ${f.sans}`)),
    document.fonts.load(`500 28px ${f.mono}`),
  ]);
  await document.fonts.ready;
  const font = (weight: number, size: number, family = f.sans) => (ctx.font = `${weight} ${size}px ${family}`);
  const spacing = (em: number, size: number) => {
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${em * size}px`;
  };

  const night = d.look === "night";
  const bg = night ? "#0B0B0C" : "#F3F1EC";
  const fg = night ? "#F2F2F0" : "#111111";
  const muted = night ? "#9A9AA0" : "#55524C";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.textBaseline = "alphabetic";

  // Foto: Day oben als Band (dunkle Punkte auf Akzent), Night groß mit Akzent-Punkten, unten ins Schwarz verlaufend
  const photoH = night ? 990 : 588;
  if (!night) {
    ctx.fillStyle = d.accent;
    ctx.fillRect(0, 0, STORY_W, photoH);
  }
  if (d.photo) {
    try {
      if (d.photo.style === "bw") drawCover(ctx, await loadImage(d.photo.bw), 0, 0, STORY_W, photoH);
      else {
        const mask = await loadImage(night ? d.photo.night : d.photo.day);
        drawCover(ctx, tint(mask, night ? d.accent : "#111111"), 0, 0, STORY_W, photoH);
      }
    } catch {
      // Foto nicht ladbar (z. B. Speicher ohne CORS): Story entsteht trotzdem, mit Farbfläche
    }
  }
  if (night) {
    // Schwarz-Weiß-Foto im Night-Look etwas abdunkeln, damit helle Fotos nicht blenden
    if (d.photo?.style === "bw") {
      ctx.fillStyle = "rgba(11,11,12,0.35)";
      ctx.fillRect(0, 0, STORY_W, photoH);
    }
    // oben: Grund für das Wortzeichen; unten: Text steht auf Schwarz
    const top = ctx.createLinearGradient(0, 0, 0, 420);
    top.addColorStop(0, "rgba(11,11,12,0.75)");
    top.addColorStop(1, "rgba(11,11,12,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, STORY_W, 420);
    const g = ctx.createLinearGradient(0, 420, 0, 720);
    g.addColorStop(0, "rgba(11,11,12,0)");
    g.addColorStop(1, "rgba(11,11,12,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 420, STORY_W, 300);
    ctx.fillStyle = "#0B0B0C";
    ctx.fillRect(0, 720, STORY_W, photoH - 720);
  }

  const genres = d.genres.join(" · ");
  const plays = d.plays.join(" · ");
  let y: number;

  if (!night) {
    // Streifen mit Sound und Plays
    const half = plays ? STORY_W / 2 : STORY_W;
    ctx.fillStyle = "#E4F45A";
    ctx.fillRect(0, photoH, half, 96);
    if (plays) {
      ctx.fillStyle = "#D4D1C8";
      ctx.fillRect(half, photoH, STORY_W - half, 96);
    }
    font(600, 39);
    spacing(0, 39);
    ctx.fillStyle = "#111111";
    ctx.fillText(ellipsize(ctx, genres, half - PAD * 2), PAD, photoH + 62);
    if (plays) ctx.fillText(ellipsize(ctx, plays, STORY_W - half - PAD * 2), half + PAD, photoH + 62);
    y = photoH + 96 + 100;
    font(800, 45);
    spacing(-0.03, 45);
    ctx.fillText("Selectorz", PAD, y);
    const w = ctx.measureText("Selectorz").width;
    ctx.beginPath();
    ctx.arc(PAD + w + 30, y - 15, 6, 0, Math.PI * 2);
    ctx.fill();
    font(600, 45);
    spacing(0, 45);
    ctx.fillText("I'm on here now.", PAD + w + 60, y);
  } else {
    font(800, 45);
    spacing(-0.03, 45);
    ctx.fillStyle = fg;
    ctx.fillText("Selectorz", PAD + 6, Math.max(SAFE.top + 50, 300));
    y = 760;
    font(600, 45);
    spacing(0, 45);
    ctx.fillStyle = d.accent;
    ctx.fillText("I'm on Selectorz now.", PAD + 6, y);
  }

  // Name: so groß wie möglich, höchstens drei Zeilen (lieber kleiner als abgeschnitten)
  ctx.fillStyle = fg;
  const fit = fitName(d.displayName, TEXT_W, (t, s) => {
    font(800, s);
    spacing(-0.055, s);
    return ctx.measureText(t).width;
  });
  font(800, fit.size);
  spacing(-0.055, fit.size);
  y += 30;
  for (const line of fit.lines) {
    y += fit.size * 0.86;
    ctx.fillText(line, PAD - 4, y);
  }

  if (!night) {
    font(400, 42);
    spacing(0, 42);
    ctx.fillStyle = muted;
    y += 78;
    ctx.fillText("My sound and the records I love.", PAD, y);
  } else {
    // Pills: Sound in Akzent, Plays in Lila
    y += 50;
    font(600, 36);
    spacing(0, 36);
    let x = PAD;
    for (const [text, color] of [[genres, d.accent], [plays, "#C9B8FF"]] as const) {
      if (!text) continue;
      const t = ellipsize(ctx, text, TEXT_W - 60);
      const w = Math.min(ctx.measureText(t).width + 60, STORY_W - PAD - x);
      if (x > PAD && x + w > STORY_W - PAD) {
        x = PAD;
        y += 96;
      }
      ctx.fillStyle = color;
      roundRect(ctx, x, y, w, 78, 39);
      ctx.fillStyle = "#0B0B0C";
      ctx.fillText(t, x + 30, y + 52);
      x += w + 18;
    }
    y += 78;
  }

  // Linie, Aufforderung und Landeplatz für den Link-Sticker (SHARE-10)
  y += 48;
  ctx.fillStyle = fg;
  ctx.fillRect(PAD, y, TEXT_W, 6);
  y += 6 + 36;
  const rowMid = y + 51;
  font(600, 45);
  spacing(0, 45);
  ctx.fillText("See how I play →", PAD, rowMid + 16);
  font(600, 36);
  const chip = "Link sticker here";
  const cw = ctx.measureText(chip).width + 60;
  ctx.fillStyle = night ? "rgba(242,242,240,0.32)" : "rgba(17,17,17,0.14)";
  roundRect(ctx, STORY_W - PAD - cw, y, cw, 102, 24);
  ctx.fillStyle = night ? "#0B0B0C" : "#111111";
  ctx.fillText(chip, STORY_W - PAD - cw + 30, rowMid + 13);
  y += 102 + 60;

  // Kurz-URL als lesbarer Text (SHARE-10a), auch ohne Sticker
  font(500, 30, f.mono);
  spacing(0.08, 30);
  ctx.fillStyle = muted;
  ctx.fillText(ellipsize(ctx, storyUrl(d.handle).toUpperCase(), TEXT_W), PAD, Math.min(y, SAFE.bottom - 20));

  // Fuß: großes Wortzeichen
  ctx.fillStyle = night ? d.accent : "#111111";
  ctx.fillRect(0, STORY_H - 288, STORY_W, 288);
  font(800, 132);
  spacing(-0.06, 132);
  ctx.fillStyle = night ? "#0B0B0C" : "#F3F1EC";
  ctx.fillText("Selectorz", PAD, STORY_H - 288 + 190);

  return canvas;
}
