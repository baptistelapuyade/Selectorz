// Punkteraster (Halftone) aus einem Foto, komplett im Browser (Plan M1b, Variante 1).
// Gespeichert wird nur das Raster als Maske: schwarze Punkte auf transparentem Grund.
// Die Farben kommen erst beim Anzeigen aus dem Look, deshalb muss bei einem Look-Wechsel nichts neu hochgeladen werden.

export const OUT_W = 800;
export const OUT_H = 1000; // 4:5 wie auf der Profilseite

export type Tune = { zoom: number; x: number; y: number; dot: number; brightness: number; contrast: number };
export const AUTO: Tune = { zoom: 1, x: 0.5, y: 0.3, dot: 12, brightness: 1.05, contrast: 1.35 };

// Helligkeit und Kontrast auf einen Grauwert (0 = schwarz, 1 = weiß).
export function tone(l: number, brightness: number, contrast: number) {
  const v = (l * brightness - 0.5) * contrast + 0.5;
  return Math.min(1, Math.max(0, v));
}

// Dunkle Stellen → große Punkte; fast weiße Stellen → kein Punkt.
export function dotRadius(l: number, cell: number) {
  const r = Math.sqrt(1 - l) * (cell / 2) * 0.95;
  return r < cell * 0.08 ? 0 : r;
}

export function cellGrid(w: number, h: number, dot: number) {
  const cell = Math.min(24, Math.max(4, Math.round(dot)));
  return { cell, cols: Math.ceil(w / cell), rows: Math.ceil(h / cell) };
}

// Ausschnitt im 4:5-Format: Zoom ≥ 1, x/y = Mittelpunkt (0..1) im Originalbild.
export function crop(srcW: number, srcH: number, t: Pick<Tune, "zoom" | "x" | "y">) {
  const target = OUT_W / OUT_H;
  let w = srcW;
  let h = srcW / target;
  if (h > srcH) {
    h = srcH;
    w = srcH * target;
  }
  w /= t.zoom;
  h /= t.zoom;
  const sx = Math.min(srcW - w, Math.max(0, t.x * srcW - w / 2));
  const sy = Math.min(srcH - h, Math.max(0, t.y * srcH - h / 2));
  return { sx, sy, sw: w, sh: h };
}

// Punktgröße für einen Grauwert. Day: Punkte für Schatten (dunkle Punkte auf Akzent).
// Night: Punkte für Licht (Akzent-Punkte auf Schwarz), sonst entsteht ein Negativ.
export function radiusFor(l: number, t: Pick<Tune, "brightness" | "contrast">, cell: number, light: boolean) {
  const v = tone(l, t.brightness, t.contrast);
  return dotRadius(light ? 1 - v : v, cell);
}

type Img = CanvasImageSource & { width: number; height: number };

// Raster auf eine Leinwand zeichnen. Läuft nur im Browser.
export function renderHalftone(img: Img, t: Tune, out: HTMLCanvasElement, light = false) {
  const { sx, sy, sw, sh } = crop(img.width, img.height, t);
  const { cell, cols, rows } = cellGrid(OUT_W, OUT_H, t.dot);
  // Durchschnitt je Zelle über ein verkleinertes Graubild
  const small = document.createElement("canvas");
  small.width = cols;
  small.height = rows;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  const px = sctx.getImageData(0, 0, cols, rows).data;

  out.width = OUT_W;
  out.height = OUT_H;
  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, OUT_W, OUT_H);
  ctx.fillStyle = "#000";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const rad = radiusFor(lum, t, cell, light);
      if (!rad) continue;
      ctx.beginPath();
      ctx.arc(c * cell + cell / 2, r * cell + cell / 2, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Schwarz-Weiß ohne Raster (PRD 14.11: wählbare Option je Profil). Graues Foto im 4:5-Ausschnitt.
export function renderBw(img: Img, t: Tune, out: HTMLCanvasElement) {
  const { sx, sy, sw, sh } = crop(img.width, img.height, t);
  out.width = OUT_W;
  out.height = OUT_H;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
  const data = ctx.getImageData(0, 0, OUT_W, OUT_H);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.round(tone((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255, t.brightness, t.contrast) * 255);
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
}
