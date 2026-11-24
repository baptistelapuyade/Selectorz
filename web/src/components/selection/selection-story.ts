"use client";

import { firstName, type Role } from "@/lib/chains";
import { palette, stampFor, type SelEntry, type SelPerson } from "@/lib/selection";
import { SAFE, SITE, STORY_H, STORY_W, fitName } from "@/lib/story";

// Selection-Story (SHARE-07/09/10): Boards StorySelBands3, StorySelPoster3, StorySelFlyer3 in 3-facher Größe
// (360 × 640 → 1080 × 1920). Gleiche Akzentfarbe: White label mit Stempel, A gefüllte Nummer, B Ring.
export type StoryFormat = "bands" | "poster" | "flyer";
export type SelStoryData = { format: StoryFormat; id: string; title: string; people: SelPerson[]; entries: SelEntry[] };

const S = 3;
const INK = "#111111";
const PAPER = "#EDEDEA";
const GREY = "#A6A6AC";

function fonts() {
  const sans = getComputedStyle(document.body).fontFamily;
  const probe = document.createElement("span");
  probe.className = "font-mono";
  document.body.appendChild(probe);
  const mono = getComputedStyle(probe).fontFamily;
  probe.remove();
  return { sans, mono };
}

type Ctx = CanvasRenderingContext2D;

function fit(x: Ctx, text: string, width: number) {
  if (x.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && x.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function arrow(x: Ctx, cx: number, cy: number, color: string, down = false) {
  x.save();
  x.strokeStyle = color;
  x.lineWidth = 6.6;
  x.lineCap = "round";
  x.lineJoin = "round";
  x.translate(cx, cy);
  if (down) x.rotate(Math.PI / 2);
  x.beginPath();
  x.moveTo(-21, 0);
  x.lineTo(21, 0);
  x.moveTo(3, -18);
  x.lineTo(21, 0);
  x.lineTo(3, 18);
  x.stroke();
  x.restore();
}

// Landeplatz für den Link-Sticker: nur die Adresse in einer halbtransparenten Pille
function pill(x: Ctx, left: number, top: number, sans: string, bg: string, fg: string) {
  x.font = `600 36px ${sans}`;
  const w = x.measureText(SITE).width + 72 + 36;
  x.fillStyle = bg;
  x.beginPath();
  x.roundRect(left, top, w, 102, 24);
  x.fill();
  x.strokeStyle = fg;
  x.lineWidth = 6;
  x.lineCap = "round";
  const cy = top + 51;
  const lx = left + 36 + 18;
  x.beginPath();
  x.arc(lx - 6, cy + 6, 9, Math.PI * 0.75, Math.PI * 1.75);
  x.moveTo(lx - 12, cy + 12);
  x.lineTo(lx + 12, cy - 12);
  x.arc(lx + 6, cy - 6, 9, Math.PI * 1.75, Math.PI * 0.75);
  x.stroke();
  x.fillStyle = fg;
  x.textBaseline = "middle";
  x.fillText(SITE, left + 36 + 54, cy + 2);
  x.textBaseline = "alphabetic";
  return w;
}

function stamp(x: Ctx, text: string, right: number, top: number, mono: string, color: string) {
  x.save();
  x.font = `600 27px ${mono}`;
  const w = x.measureText(text).width + 36;
  x.translate(right - w / 2, top + 33);
  x.rotate(-0.06);
  x.strokeStyle = color;
  x.lineWidth = 4.5;
  x.strokeRect(-w / 2, -33, w, 66);
  x.fillStyle = color;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, 0, 2);
  x.restore();
}

// Nummer: farbig gefüllt; im White label A gefüllt (schwarz), B als Ring
function num(x: Ctx, n: number, role: Role, cx: number, cy: number, mono: string, white: boolean, fill: string) {
  const label = String(n).padStart(2, "0");
  x.font = `600 30px ${mono}`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  if (white) {
    x.beginPath();
    x.arc(cx, cy, 27, 0, Math.PI * 2);
    if (role === "A") {
      x.fillStyle = INK;
      x.fill();
      x.fillStyle = "#FFFFFF";
    } else {
      x.strokeStyle = INK;
      x.lineWidth = 4;
      x.stroke();
      x.fillStyle = INK;
    }
    x.fillText(String(n), cx, cy + 1);
  } else {
    x.fillStyle = fill;
    x.fillText(label, cx, cy + 1);
  }
  x.textAlign = "left";
  x.textBaseline = "alphabetic";
}

export async function drawSelectionStory(d: SelStoryData): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const { sans, mono } = fonts();
  const c = document.createElement("canvas");
  c.width = STORY_W;
  c.height = STORY_H;
  const x = c.getContext("2d")!;
  const col = palette(d.people);
  const name = (r: Role) => firstName(d.people.find((p) => p.role === r)?.name ?? "");
  const pair = `${name("A")} × ${name("B")}`;
  const measure = (t: string, size: number) => {
    x.font = `800 ${size}px ${sans}`;
    return x.measureText(t).width;
  };
  const title = d.title;
  const stampText = col.white ? stampFor(d.id) : null;

  if (d.format === "flyer") {
    x.fillStyle = PAPER;
    x.fillRect(0, 0, STORY_W, STORY_H);
    const top = 84 * S;
    const cw = STORY_W / 3.2;
    x.fillStyle = INK;
    x.fillRect(0, top, cw * 1.2, 44 * S);
    x.fillStyle = col.A;
    x.fillRect(cw * 1.2, top, cw, 44 * S);
    x.fillStyle = col.B;
    x.fillRect(cw * 2.2, top, STORY_W - cw * 2.2, 44 * S);
    x.fillStyle = PAPER;
    x.font = `800 45px ${sans}`;
    x.textBaseline = "middle";
    x.fillText("Selectorz", 18 * S, top + 22 * S);
    x.fillStyle = INK;
    const blocks: [string, string][] = [["TRACK CHAIN", `${d.entries.length} tracks`], stampText ? ["WHITE LABEL", stampText] : ["PICKED BY", "2 DJs"]];
    for (const [i, [k, v]] of blocks.entries()) {
      const left = cw * (1.2 + i) + 30;
      x.font = `400 24px ${mono}`;
      x.fillText(k, left, top + 14 * S);
      x.font = `600 39px ${sans}`;
      x.fillText(v, left, top + 30 * S);
    }
    x.textBaseline = "alphabetic";
    const t = fitName(title, STORY_W - 108, measure, 210, 96);
    let y = top + 44 * S + 18 * S;
    x.font = `800 ${t.size}px ${sans}`;
    for (const line of t.lines) {
      y += t.size * 0.84;
      x.fillText(line, 54, y);
    }
    y += 12 * S + 48;
    x.font = `500 48px ${sans}`;
    x.fillText(`${pair}, taking turns.`, 54, y);
    y += 16 * S + 12;
    x.fillRect(54, y, STORY_W - 108, 6);
    y += 12 * S + 6;
    const colW = (STORY_W - 108 - 42) / 2;
    const rowH = Math.min(141, (SAFE.bottom - 210 - y) / 3);
    d.entries.slice(0, 6).forEach((e, i) => {
      const left = 54 + (i % 2) * (colW + 42);
      const ty = y + Math.floor(i / 2) * rowH;
      const color = e.role === "A" ? col.A : col.B;
      if (col.white) num(x, e.position, e.role, left + 27, ty + 27, mono, true, INK);
      else {
        x.fillStyle = color;
        x.beginPath();
        x.roundRect(left, ty + 6, 72, 48, 24);
        x.fill();
        x.fillStyle = INK;
        x.font = `600 24px ${mono}`;
        x.textAlign = "center";
        x.fillText(String(e.position).padStart(2, "0"), left + 36, ty + 39);
        x.textAlign = "left";
      }
      x.fillStyle = INK;
      x.font = `700 39px ${sans}`;
      x.fillText(fit(x, e.title, colW - 96), left + 96, ty + 42);
      x.fillStyle = "#57575A";
      x.font = `400 30px ${sans}`;
      x.fillText(fit(x, e.artist, colW - 96), left + 96, ty + 84);
    });
    const cta = Math.min(y + rowH * 3 + 18, SAFE.bottom - 120);
    x.fillStyle = INK;
    x.font = `600 45px ${sans}`;
    x.fillText("Listen to all six", 54, cta + 66);
    arrow(x, 54 + x.measureText("Listen to all six").width + 80, cta + 51, INK);
    x.font = `600 36px ${sans}`;
    const pw = x.measureText(SITE).width + 108;
    pill(x, STORY_W - 54 - pw, cta, sans, "rgba(17,17,17,0.18)", INK);
    return c;
  }

  x.fillStyle = INK;
  x.fillRect(0, 0, STORY_W, STORY_H);

  if (d.format === "poster") {
    // Punktmatrix: sechs Säulen, abwechselnd in den Personenfarben, wachsen nach rechts
    const cols = 17, rows = 26, gap = 9;
    const left = 66, width = STORY_W - 132;
    const cell = (width - gap * (cols - 1)) / cols;
    const bottom = STORY_H - 180;
    const heights = [4, 5, 6, 16, 21, 26];
    for (let r = 0; r < rows; r++)
      for (let cc = 0; cc < cols; cc++) {
        const block = Math.floor(cc / 3), inBlock = cc % 3 !== 2;
        const filled = inBlock && block < 6 && r >= rows - heights[block];
        x.fillStyle = filled ? (block % 2 === 0 ? col.A : col.B) : "#1F1F22";
        x.beginPath();
        x.arc(left + cc * (cell + gap) + cell / 2, bottom - (rows - r) * (cell + gap) + cell / 2, cell / 2, 0, Math.PI * 2);
        x.fill();
      }
    const w = 168 * S;
    let y = 90 * S;
    x.fillStyle = PAPER;
    x.font = `800 45px ${sans}`;
    x.fillText("Selectorz", 66, y + 36);
    y += 36 + 24;
    const t = fitName(title, w, measure, 138, 72);
    x.font = `800 ${t.size}px ${sans}`;
    for (const line of t.lines) {
      y += t.size * 0.88;
      x.fillText(line, 66, y);
    }
    y += 36;
    x.font = `500 42px ${sans}`;
    const words = `Six tracks, back and forth between ${name("A")} and ${name("B")}.`.split(" ");
    let line = "";
    const lines: string[] = [];
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (x.measureText(next).width > w + 60 && line) {
        lines.push(line);
        line = wd;
      } else line = next;
    }
    lines.push(line);
    for (const l of lines) {
      y += 57;
      x.fillText(l, 66, y);
    }
    y += 24 + 45;
    x.font = `600 45px ${sans}`;
    x.fillText("Listen", 66, y);
    arrow(x, 66 + x.measureText("Listen").width + 40, y - 15, PAPER, true);
    pill(x, 66, y + 24, sans, "rgba(237,237,234,0.32)", INK);
    if (stampText) stamp(x, stampText, 66 + 330, y + 168, mono, PAPER);
    return c;
  }

  // Bands (Standard)
  const L = 66;
  let y = 90 * S;
  x.fillStyle = PAPER;
  x.font = `800 45px ${sans}`;
  x.fillText("Selectorz", L, y + 36);
  if (stampText) stamp(x, stampText, STORY_W - L, y - 4, mono, PAPER);
  else {
    x.fillStyle = GREY;
    x.font = `400 27px ${mono}`;
    x.textAlign = "right";
    x.fillText(`TRACK CHAIN · ${d.entries.length}/${d.entries.length}`, STORY_W - L, y + 30);
    x.textAlign = "left";
  }
  y += 36 + 48;
  // Höhe passt sich an: lange Titel nehmen den Bändern etwas Höhe, nie den Sicherheitszonen
  const t = fitName(title, STORY_W - L * 2, measure, 156, 84);
  const titleH = t.lines.length * t.size * 0.9;
  const fixed = 30 + 48 + 54 + 102;
  const band = Math.max(84, Math.min(114, (SAFE.bottom - 24 - y - titleH - fixed) / 6));
  x.fillStyle = PAPER;
  x.font = `800 ${t.size}px ${sans}`;
  for (const ln of t.lines) {
    y += t.size * 0.9;
    x.fillText(ln, L, y);
  }
  y += 30 + 48;
  x.font = `500 48px ${sans}`;
  x.fillText(col.white ? `${pair} picked the same colour.` : `${pair} picked six tracks, back and forth.`, L, y, STORY_W - L * 2);
  y += 54;
  d.entries.slice(0, 6).forEach((e, i) => {
    const top = y + i * band;
    const right = e.role === "B";
    x.fillStyle = e.role === "A" ? col.A : col.B;
    x.fillRect(0, top, STORY_W, band);
    const cy = top + band / 2;
    x.fillStyle = INK;
    x.textBaseline = "middle";
    x.font = `800 48px ${sans}`;
    const titleW = STORY_W - L * 2 - 300;
    const tt = fit(x, e.title, titleW);
    const tw = x.measureText(tt).width;
    x.font = `400 30px ${sans}`;
    const at = fit(x, e.artist, STORY_W - L * 2 - 90 - tw - 30);
    const aw = x.measureText(at).width;
    if (!right) {
      num(x, e.position, e.role, L + 18, cy, mono, col.white, INK);
      x.fillStyle = INK;
      x.font = `800 48px ${sans}`;
      x.fillText(tt, L + 60, cy + 2);
      x.font = `400 30px ${sans}`;
      x.fillText(at, L + 60 + tw + 30, cy + 4);
    } else {
      num(x, e.position, e.role, STORY_W - L - 18, cy, mono, col.white, INK);
      x.fillStyle = INK;
      x.font = `800 48px ${sans}`;
      x.fillText(tt, STORY_W - L - 60 - tw, cy + 2);
      x.font = `400 30px ${sans}`;
      x.fillText(at, STORY_W - L - 60 - tw - 30 - aw, cy + 4);
    }
    x.textBaseline = "alphabetic";
  });
  y += band * 6 + 54;
  x.fillStyle = PAPER;
  x.font = `600 45px ${sans}`;
  x.fillText("Listen to all six", L, y + 66);
  arrow(x, L + x.measureText("Listen to all six").width + 80, y + 51, PAPER);
  x.font = `600 36px ${sans}`;
  const pw = x.measureText(SITE).width + 108;
  pill(x, STORY_W - L - pw, y, sans, "rgba(237,237,234,0.32)", INK);
  return c;
}
