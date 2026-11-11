// Aus erkannten Beats/Downbeats ein konstantes Raster, Phrasen, Energie pro Takt,
// Intro und Outro ableiten. Reine Funktionen.
import type { BarEnergy, BeatGrid } from '../types';
import { FPS } from './features';

const INLIER_S = 0.035;

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function linfit(k: number[], t: number[]): { a: number; p: number } {
  const n = k.length;
  let sk = 0, st = 0, skk = 0, skt = 0;
  for (let i = 0; i < n; i++) { sk += k[i]; st += t[i]; skk += k[i] * k[i]; skt += k[i] * t[i]; }
  const p = (n * skt - sk * st) / (n * skk - sk * sk);
  const a = (st - p * sk) / n;
  return { a, p };
}

export function medianBpm(beats: number[]): number {
  const d: number[] = [];
  for (let i = 1; i < beats.length; i++) d.push(beats[i] - beats[i - 1]);
  return 60 / median(d);
}

/**
 * Konstantes 4/4-Raster per robuster linearer Regression über alle Beats.
 * Ein BPM-Fehler von 0,1 % verschiebt nach 32 Takten schon ~60 ms – deshalb Regression
 * statt nur Median.
 */
export function fitGrid(beats: number[], downbeats: number[], duration: number): BeatGrid | null {
  if (beats.length < 8) return null;
  // 1) Grobe Periode: Median über 8-Beat-Spannen (Frame-Raster von 20 ms mittelt sich heraus)
  const spans: number[] = [];
  for (let i = 0; i + 8 < beats.length; i++) spans.push((beats[i + 8] - beats[i]) / 8);
  const pMed = median(spans.length ? spans : [60 / medianBpm(beats)]);
  // 2) Globale Suche über Periode und Phase: maximiere die Zahl der Beats auf dem Raster.
  //    Robust gegen einzelne falsche oder fehlende Beats (z. B. im Break).
  let best = { p: pMed, a: beats[0], score: -1 };
  const bins = 72;
  for (let s = -300; s <= 300; s++) {
    const p = pMed * (1 + s * 0.0001);
    const hist = new Float64Array(bins);
    for (const b of beats) {
      const ph = (((b / p) % 1) + 1) % 1;
      hist[Math.floor(ph * bins) % bins]++;
    }
    // Fensterbreite ≈ ±INLIER_S
    const w = Math.max(1, Math.round(((2 * INLIER_S) / p) * bins));
    for (let c = 0; c < bins; c++) {
      let sc = 0;
      for (let j = 0; j < w; j++) sc += hist[(c + j) % bins];
      if (sc > best.score) best = { p, a: ((c + w / 2) / bins) * p, score: sc };
    }
  }
  // 3) Indizes vergeben und mit den passenden Beats per Regression verfeinern
  let fit = { a: best.a, p: best.p };
  let idx: number[] = beats.map((b) => Math.round((b - fit.a) / fit.p));
  for (let iter = 0; iter < 4; iter++) {
    const k2: number[] = [];
    const t2: number[] = [];
    for (let i = 0; i < beats.length; i++) {
      if (Math.abs(beats[i] - (fit.a + fit.p * idx[i])) < INLIER_S) { k2.push(idx[i]); t2.push(beats[i]); }
    }
    if (k2.length < 8) break;
    fit = linfit(k2, t2);
    idx = beats.map((b) => Math.round((b - fit.a) / fit.p));
  }
  const resid = beats.map((b, i) => Math.abs(b - (fit.a + fit.p * idx[i])));
  const inliers = resid.filter((r) => r < INLIER_S).length;

  // Takt-Phase: Mehrheitsentscheid der Downbeats modulo 4
  const votes = [0, 0, 0, 0];
  for (const d of downbeats) {
    const k = Math.round((d - fit.a) / fit.p);
    votes[((k % 4) + 4) % 4]++;
  }
  let phase = 0;
  for (let i = 1; i < 4; i++) if (votes[i] > votes[phase]) phase = i;
  const total = votes.reduce((x, y) => x + y, 0);

  // erster Downbeat >= 0
  let k0 = Math.ceil(-fit.a / fit.p - 1e-9);
  while ((((k0 - phase) % 4) + 4) % 4 !== 0) k0++;
  const t0 = fit.a + fit.p * k0;
  const barCount = Math.max(0, Math.floor((duration - t0) / (4 * fit.p) + 1e-6));
  return {
    t0,
    period: fit.p,
    beatsPerBar: 4,
    barCount,
    residualMs: median(resid) * 1000,
    inlierShare: inliers / beats.length,
    downbeatConfidence: total ? votes[phase] / total : 0,
    phaseShiftMs: 0,
  };
}

/**
 * Feinjustierung der Raster-Phase an den Kick-Einsätzen.
 * Beat This! liefert Beats im 20-ms-Raster und (je nach Material) mit einigen ms Versatz
 * zum hörbaren Einsatz. Für taktgenaue Übergänge richten wir das Raster an der
 * Onset-Funktion des Bassbands (< 150 Hz) aus: Verschiebung δ in ±25 ms, die die Summe
 * der Onset-Stärke an allen Rasterpositionen maximiert.
 * Gibt die Verschiebung in Sekunden zurück (positiv = später).
 */
/** Wendet die Feinjustierung an (t0 verschieben, Taktzahl neu). */
export function applyPhaseShift(grid: BeatGrid, shift: number, duration: number): BeatGrid {
  let t0 = grid.t0 + shift;
  if (t0 < 0) t0 += 4 * grid.period;
  const barCount = Math.max(0, Math.floor((duration - t0) / (4 * grid.period) + 1e-6));
  return { ...grid, t0, barCount, phaseShiftMs: shift * 1000 };
}

export function refinePhase(pcm: Float32Array, sampleRate: number, grid: Pick<BeatGrid, 't0' | 'period'>, maxShift = 0.025): number {
  // Tiefpass 2. Ordnung (RBJ) bei 150 Hz
  const w0 = (2 * Math.PI * 150) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const cw = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, b2 = b0, a1 = (-2 * cw) / a0, a2 = (1 - alpha) / a0;
  const hop = 32; // ~1,5 ms bei 22 050 Hz
  const nFrames = Math.floor(pcm.length / hop);
  const env = new Float32Array(nFrames);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let f = 0; f < nFrames; f++) {
    let e = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) {
      const x = pcm[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      e += y * y;
    }
    env[f] = Math.sqrt(e / hop);
  }
  // Onset-Funktion: positive Änderung, logarithmisch komprimiert
  const odf = new Float32Array(nFrames);
  for (let f = 1; f < nFrames; f++) odf[f] = Math.max(0, Math.log1p(100 * env[f]) - Math.log1p(100 * env[f - 1]));
  const fps = sampleRate / hop;
  const steps = Math.round(maxShift * fps);
  let best = 0;
  let bestScore = -Infinity;
  for (let s = -steps; s <= steps; s++) {
    let score = 0;
    for (let t = grid.t0 + (s / fps); t < pcm.length / sampleRate; t += grid.period) {
      if (t < 0) continue;
      const f = Math.round(t * fps);
      // kleines Fenster (±1 Frame), damit der Anstieg sicher getroffen wird
      score += (odf[f - 1] ?? 0) + (odf[f] ?? 0) + (odf[f + 1] ?? 0);
    }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best / fps;
}

export function barTime(grid: Pick<BeatGrid, 't0' | 'period'>, bar: number): number {
  return grid.t0 + bar * 4 * grid.period;
}

const dB = (x: number) => 10 * Math.log10(x + 1e-12);

/** Mittlere Bandleistung je Takt (dB). */
export function barEnergies(grid: BeatGrid, low: Float32Array, mid: Float32Array, high: Float32Array): BarEnergy[] {
  const out: BarEnergy[] = [];
  for (let b = 0; b < grid.barCount; b++) {
    const f0 = Math.max(0, Math.round(barTime(grid, b) * FPS));
    const f1 = Math.min(low.length, Math.round(barTime(grid, b + 1) * FPS));
    let l = 0, m = 0, h = 0;
    for (let f = f0; f < f1; f++) { l += low[f]; m += mid[f]; h += high[f]; }
    const n = Math.max(1, f1 - f0);
    out.push({ low: dB(l / n), mid: dB(m / n), high: dB(h / n) });
  }
  return out;
}

const total = (e: BarEnergy) => dB(10 ** (e.low / 10) + 10 ** (e.mid / 10) + 10 ** (e.high / 10));

function meanOf(xs: number[], from: number, to: number): number {
  const a = Math.max(0, from);
  const b = Math.min(xs.length, to);
  if (b <= a) return NaN;
  let s = 0;
  for (let i = a; i < b; i++) s += xs[i];
  return s / (b - a);
}

/** Versatz des 8-Takt-Phrasenrasters: dort, wo sich die Energie am stärksten ändert. */
export function phraseOffset(bars: BarEnergy[], phraseBars = 8): number {
  if (bars.length < phraseBars * 3) return 0;
  const nov: number[] = [0];
  for (let b = 1; b < bars.length; b++) {
    nov.push(
      Math.abs(bars[b].low - bars[b - 1].low) + Math.abs(bars[b].mid - bars[b - 1].mid) + Math.abs(bars[b].high - bars[b - 1].high),
    );
  }
  const score = (o: number) => {
    let s = 0, n = 0;
    for (let b = o; b < bars.length; b += phraseBars) if (b > 0) { s += nov[b]; n++; }
    return n ? s / n : 0;
  };
  let best = 0;
  let bestScore = score(0);
  for (let o = 1; o < phraseBars; o++) {
    const s = score(o);
    if (s > bestScore * 1.25 && s > bestScore) { best = o; bestScore = s; }
  }
  return best;
}

export interface Sections {
  introEndBar: number;
  outroStartBar: number;
  introSource: 'energy' | 'bass' | 'default';
  outroSource: 'energy' | 'bass' | 'default';
}

/**
 * Intro endet am ersten großen Energiesprung (oder wenn der Bass voll einsetzt),
 * Outro beginnt am letzten großen Energieabfall (oder wenn der Bass geht).
 * Alles auf Phrasengrenzen.
 */
export function detectSections(bars: BarEnergy[], offset: number, phraseBars = 8): Sections {
  const n = bars.length;
  const tot = bars.map(total);
  const low = bars.map((b) => b.low);
  const mid = bars.map((b) => b.mid);
  const sortedLow = [...low].sort((a, b) => a - b);
  const fullLow = sortedLow[Math.floor(sortedLow.length * 0.8)] ?? 0;
  const starts: number[] = [];
  for (let p = offset; p < n; p += phraseBars) starts.push(p);
  const P = phraseBars;

  let introEndBar = -1;
  let introSource: Sections['introSource'] = 'default';
  for (const p of starts) {
    if (p < P || p > 0.45 * n) continue;
    const jump = Math.max(meanOf(tot, p, p + P) - meanOf(tot, p - P, p), meanOf(mid, p, p + P) - meanOf(mid, p - P, p));
    const lowJump = meanOf(low, p, p + P) - meanOf(low, p - P, p);
    const bassIn = lowJump >= 3 || (meanOf(low, p - P, p) < fullLow - 6 && meanOf(low, p, p + P) >= fullLow - 3);
    if (jump >= 3) { introEndBar = p; introSource = 'energy'; break; }
    if (bassIn) { introEndBar = p; introSource = 'bass'; break; }
  }
  if (introEndBar < 0) introEndBar = starts.find((p) => p >= 16) ?? Math.min(16, n);

  let outroStartBar = -1;
  let outroSource: Sections['outroSource'] = 'default';
  for (let i = starts.length - 1; i >= 0; i--) {
    const p = starts[i];
    if (p > n - 16 || p < 0.55 * n) continue;
    const drop = Math.max(meanOf(tot, p - P, p) - meanOf(tot, p, p + P), meanOf(mid, p - P, p) - meanOf(mid, p, p + P));
    const lowDrop = meanOf(low, p - P, p) - meanOf(low, p, p + P);
    const bassOut = lowDrop >= 3 || (meanOf(low, p - P, p) >= fullLow - 3 && meanOf(low, p, p + P) < fullLow - 6);
    if (drop >= 3) { outroStartBar = p; outroSource = 'energy'; break; }
    if (bassOut) { outroStartBar = p; outroSource = 'bass'; break; }
  }
  if (outroStartBar < 0) {
    const cands = starts.filter((p) => p <= n - 32);
    outroStartBar = cands.length ? cands[cands.length - 1] : Math.max(0, n - 16);
  }
  return { introEndBar, outroStartBar, introSource, outroSource };
}
