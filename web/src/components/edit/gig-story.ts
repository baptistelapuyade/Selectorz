"use client";

import { gigDate, untilLabel, type Gig } from "@/lib/gigs";
import { SAFE, STORY_H, STORY_W, fitName, storyUrl } from "@/lib/story";

// Story aus Gigs (Boards GigsStoryVariants/GigsStoryNames, 23.11.2026):
// „one“ = Foto und Ticket (S2), „all“ = die nächsten drei (S3). 1080 × 1920, Instagram-Zonen bleiben frei.
export type GigStoryData = {
  kind: "one" | "all";
  gigs: Gig[];                 // „one“: [der Gig]; „all“: die nächsten bis zu drei
  name: string;
  genres: string[];
  handle: string;
  look: "day" | "night";
  accent: string;
  photo: string | null;        // öffentliche Adresse der Maske bzw. des Schwarz-Weiß-Bilds
  photoStyle: "dots" | "bw";
};

const PAD = 70;
const W = STORY_W - PAD * 2;
const TOP = SAFE.top + 48;
const BOTTOM = SAFE.bottom - 40;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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

// Ticket mit echten Kerben (ausgestanzt), als eigenes Bild
function ticketShape(w: number, h: number, stub: number, fill: string) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = fill;
  x.beginPath();
  x.roundRect(0, 0, w, h, 32);
  x.fill();
  x.globalCompositeOperation = "destination-out";
  for (const y of [0, h]) {
    x.beginPath();
    x.arc(stub, y, 24, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

export async function drawGigStory(d: GigStoryData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext("2d")!;
  const f = fonts();
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
  const surface = night ? "#141416" : "#FFFFFF";
  const line = night ? "#2E2E33" : "#CFCBC1";
  const htBg = night ? "#0B0B0C" : d.accent;
  const htDot = night ? d.accent : "#111111";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.textBaseline = "alphabetic";

  const mono = (text: string, x: number, y: number, size = 27, color = muted, align: CanvasTextAlign = "left") => {
    font(500, size, f.mono);
    spacing(0.1, size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = "left";
  };

  const drawPhoto = async (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = htBg;
    ctx.fillRect(x, y, w, h);
    if (!d.photo) return;
    try {
      const img = await loadImage(d.photo);
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (img.width - sw) / 2;
      const sy = Math.min(img.height - sh, Math.max(0, img.height * 0.3 - sh / 2));
      if (d.photoStyle === "bw") ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      else {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const t = c.getContext("2d")!;
        t.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        t.globalCompositeOperation = "source-in";
        t.fillStyle = htDot;
        t.fillRect(0, 0, w, h);
        ctx.drawImage(c, x, y);
      }
    } catch {
      // Foto nicht ladbar: Fläche in Lookfarbe bleibt
    }
  };

  const drawTicket = (g: Gig, x: number, y: number, w: number, h: number, next: boolean, big: boolean) => {
    const stub = big ? 288 : 204;
    const fill = next ? fg : surface;
    const ink = next ? bg : fg;
    const shape = ticketShape(w, h, stub, fill);
    ctx.save();
    if (next) {
      for (const [dx, color] of [[-16, "rgba(140,147,255,0.55)"], [16, "rgba(240,83,42,0.45)"]] as const) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 44;
        ctx.shadowOffsetX = dx;
        ctx.drawImage(shape, x, y);
      }
    } else {
      ctx.shadowColor = line;
      ctx.shadowBlur = 3;
      ctx.drawImage(shape, x, y);
    }
    ctx.restore();
    ctx.drawImage(shape, x, y);
    // gestrichelte Abrisslinie
    ctx.save();
    ctx.strokeStyle = next ? "rgba(127,127,127,0.55)" : line;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(x + stub, y + 30);
    ctx.lineTo(x + stub, y + h - 30);
    ctx.stroke();
    ctx.restore();
    // Abriss: Wochentag, Tag, Monat
    const dd = gigDate(g.date);
    const cx = x + stub / 2;
    const daySize = big ? 140 : Math.min(96, h * 0.46);
    ctx.globalAlpha = 0.7;
    mono(dd.wd, cx, y + h / 2 - daySize * 0.5, big ? 32 : 26, ink, "center");
    ctx.globalAlpha = 1;
    font(800, daySize);
    spacing(-0.05, daySize);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.fillText(dd.day, cx, y + h / 2 + daySize * 0.34);
    ctx.textAlign = "left";
    mono(dd.mon, cx, y + h / 2 + daySize * 0.34 + (big ? 50 : 36), big ? 34 : 28, ink, "center");
    // rechts: Hinweis, Event, Stadt
    const tx = x + stub + (big ? 52 : 40);
    const tw = w - stub - (big ? 90 : 70);
    ctx.globalAlpha = 0.75;
    mono(next ? `NEXT · ${untilLabel(g.date)}` : untilLabel(g.date), tx, y + (big ? 72 : 56), 26, ink);
    ctx.globalAlpha = 1;
    if (next) {
      ctx.fillStyle = "#8C93FF";
      ctx.beginPath();
      ctx.arc(tx - 22, y + (big ? 63 : 47), 9, 0, Math.PI * 2);
      ctx.fill();
    }
    const es = big ? 68 : h < 200 ? 44 : 50;
    font(800, es);
    spacing(-0.025, es);
    ctx.fillStyle = ink;
    const words = g.event.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const wd of words) {
      const t = cur ? `${cur} ${wd}` : wd;
      if (!cur || ctx.measureText(t).width <= tw) cur = t;
      else {
        lines.push(cur);
        cur = wd;
      }
    }
    if (cur) lines.push(cur);
    const maxLines = big ? 2 : 1;
    const show = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let last = show[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > tw) last = last.slice(0, -1);
      show[maxLines - 1] = `${last}…`;
    }
    const cityY = y + h - (big ? 52 : 34);
    let ey = cityY - (big ? 62 : 46) - (show.length - 1) * es * 1.05;
    for (const l of show) {
      ctx.fillText(l, tx, ey);
      ey += es * 1.05;
    }
    font(400, big ? 40 : 34);
    spacing(0, 34);
    ctx.globalAlpha = 0.75;
    ctx.fillText(g.city, tx, cityY);
    ctx.globalAlpha = 1;
  };

  // Fuß: freier Platz für den Link-Sticker, darunter die Adresse (SHARE-10/10a)
  const addressY = BOTTOM;
  const stickerTop = addressY - 40 - 110;
  mono(storyUrl(d.handle).toUpperCase(), STORY_W / 2, addressY, 27, fg, "center");

  const nameFit = (width: number, max: number, min: number) => {
    const measure = (t: string, s: number) => {
      font(800, s);
      spacing(-0.06, s);
      return ctx.measureText(t).width;
    };
    for (let size = max; size >= min; size -= 4) {
      const r = fitName(d.name, width, measure, size, size);
      // nur echte Treffer: höchstens 3 Zeilen, Umbruch zwischen Wörtern (kein Notfall-Trennen)
      if (r.lines.length <= 3 && r.lines.join(" ") === d.name.trim().split(/\s+/).join(" ") && r.lines.every((l) => measure(l, size) <= width)) return r;
    }
    return null;
  };
  const drawName = (lines: string[], size: number, x: number, bottomY: number) => {
    font(800, size);
    spacing(-0.06, size);
    ctx.fillStyle = fg;
    let y = bottomY - (lines.length - 1) * size * 0.86;
    for (const l of lines) {
      ctx.fillText(l, x, y);
      y += size * 0.86;
    }
  };

  if (d.kind === "one") {
    const g = d.gigs[0];
    const ticketH = 395;
    const photoW = 400;
    const narrowW = (W - photoW - 37) * 0.92;
    const narrow = nameFit(narrowW, 123, 80);
    let topEnd: number;
    if (narrow) {
      const photoH = 453;
      await drawPhoto(STORY_W - PAD - photoW, TOP, photoW, photoH);
      mono("PLAYING SOON", PAD, TOP + photoH - narrow.lines.length * narrow.size * 0.86 - 40);
      drawName(narrow.lines, narrow.size, PAD - 4, TOP + photoH - 6);
      topEnd = TOP + photoH;
      // Ticket mittig im freien Raum zwischen Foto und Sticker
      const free = stickerTop - topEnd;
      drawTicket(g, PAD, topEnd + (free - ticketH) / 2, W, ticketH, true, true);
    } else {
      const wide = nameFit(W * 0.92, 123, 64) ?? fitName(d.name, W * 0.92, (t, s) => (font(800, s), ctx.measureText(t).width), 64, 64);
      mono("PLAYING SOON", PAD, TOP + 26);
      const first = TOP + 60 + wide.size * 0.82;
      const lastBaseline = first + (wide.lines.length - 1) * wide.size * 0.86;
      drawName(wide.lines, wide.size, PAD - 4, lastBaseline);
      const nameBottom = lastBaseline + wide.size * 0.2;
      const flatH = 315;
      const photoTop = nameBottom + 30;
      const ticketY = stickerTop - 40 - flatH;
      await drawPhoto(PAD, photoTop, W, Math.max(320, ticketY - 32 - photoTop));
      drawTicket(g, PAD, ticketY, W, flatH, true, false);
    }
  } else {
    // „Where to hear me“ oben, die Tickets unten
    font(800, 117);
    spacing(-0.06, 117);
    ctx.fillStyle = fg;
    ctx.fillText("Where to", PAD - 4, TOP + 90);
    ctx.fillText("hear me", PAD - 4, TOP + 90 + 100);
    mono(d.name.toUpperCase().slice(0, 28), STORY_W - PAD, TOP + 150, 26, muted, "right");
    mono(d.genres.slice(0, 2).join(" · ").toUpperCase().slice(0, 28), STORY_W - PAD, TOP + 190, 26, muted, "right");
    const hs = [224, 187, 187].slice(0, d.gigs.length);
    const gap = 24;
    const total = hs.reduce((a, b) => a + b, 0) + gap * (hs.length - 1);
    let y = stickerTop - 30 - total;
    d.gigs.slice(0, 3).forEach((g, i) => {
      drawTicket(g, PAD, y, W, hs[i], i === 0, false);
      y += hs[i] + gap;
    });
  }
  return canvas;
}
