import { describe, expect, it } from 'vitest';
import type { BarEnergy } from '../types';
import { barTime, detectSections, fitGrid, phraseOffset, refinePhase } from './grid';
import { peakFrames, postprocess } from './postprocess';

/** Beats wie aus Beat This!: auf 20-ms-Frames gerundet, mit Störungen. */
function detected(bpm: number, bars: number, t0 = 0.3, opts: { spurious?: number[]; missing?: number[] } = {}) {
  const p = 60 / bpm;
  const beats: number[] = [];
  for (let k = 0; k < bars * 4; k++) {
    if (opts.missing?.includes(k)) continue;
    beats.push(Math.round((t0 + k * p) * 50) / 50);
  }
  for (const s of opts.spurious ?? []) beats.push(Math.round((t0 + s * p) * 50) / 50);
  beats.sort((a, b) => a - b);
  const downbeats = beats.filter((b) => Math.abs(((b - t0) / p) % 4) < 0.1);
  return { beats, downbeats, duration: t0 + bars * 4 * p + 0.5 };
}

describe('fitGrid', () => {
  it('trifft das Tempo trotz 20-ms-Raster auf 0,01 BPM', () => {
    for (const bpm of [118, 122, 124, 125.5, 128, 132]) {
      const d = detected(bpm, 96);
      const g = fitGrid(d.beats, d.downbeats, d.duration)!;
      expect(Math.abs(60 / g.period - bpm)).toBeLessThan(0.01);
      expect(g.inlierShare).toBeGreaterThan(0.99);
      expect(g.t0).toBeCloseTo(0.3, 2);
      expect(g.barCount).toBe(96);
    }
  });

  it('ist robust gegen falsche Beats (Break) und fehlende Beats', () => {
    const d = detected(122, 96, 0.3, { spurious: [200.5, 201.5, 202.5, 210.5], missing: [10, 11, 205, 206, 207] });
    const g = fitGrid(d.beats, d.downbeats, d.duration)!;
    expect(Math.abs(60 / g.period - 122)).toBeLessThan(0.01);
    expect(g.downbeatConfidence).toBeGreaterThan(0.9);
    expect(g.t0).toBeCloseTo(0.3, 2);
  });

  it('findet die Takt-Phase aus den Downbeats', () => {
    const d = detected(124, 64, 0.3);
    const p = 60 / 124;
    const shifted = d.downbeats.map((x) => Math.round((x + 2 * p) * 50) / 50); // „eins“ liegt zwei Beats später
    const g = fitGrid(d.beats, shifted, d.duration)!;
    expect(g.t0).toBeCloseTo(0.3 + 2 * p, 2);
  });

  it('meldet Tempowechsel über eine niedrige Trefferquote', () => {
    const a = detected(124, 32, 0.3);
    const end = a.beats[a.beats.length - 1];
    const b = detected(128, 32, end + 60 / 128);
    const g = fitGrid([...a.beats, ...b.beats], [...a.downbeats, ...b.downbeats], b.duration)!;
    expect(g.inlierShare).toBeLessThan(0.8);
  });
});

describe('refinePhase', () => {
  it('richtet ein um 12 ms verschobenes Raster an den Kicks aus', () => {
    const sr = 22050;
    const bpm = 124;
    const p = 60 / bpm;
    const pcm = new Float32Array(sr * 30);
    let s = 7;
    for (let i = 0; i < pcm.length; i++) { s = (s * 16807) % 2147483647; pcm[i] = (s / 2147483647 - 0.5) * 0.02; } // Rauschen
    for (let t = 0.5; t < 29.5; t += p) {
      const at = Math.round(t * sr);
      for (let i = 0; i < sr * 0.25; i++) {
        const tt = i / sr;
        pcm[at + i] += 0.8 * Math.sin(2 * Math.PI * (50 * tt + (70 / 25) * (1 - Math.exp(-25 * tt)))) * Math.exp(-tt / 0.12);
      }
    }
    const shift = refinePhase(pcm, sr, { t0: 0.5 + 0.012, period: p });
    expect(Math.abs(shift + 0.012)).toBeLessThan(0.0025);
  });
});

describe('Phrasen und Abschnitte', () => {
  const bar = (low: number, mid: number, high: number): BarEnergy => ({ low, mid, high });

  it('Intro endet am Energiesprung, Outro beginnt am Abfall', () => {
    const bars: BarEnergy[] = [];
    for (let b = 0; b < 96; b++) {
      const main = b >= 16 && b < 80;
      bars.push(main ? bar(-5, -8, -15) : bar(-6, -20, -16));
    }
    const s = detectSections(bars, 0);
    expect(s.introEndBar).toBe(16);
    expect(s.outroStartBar).toBe(80);
    expect(s.introSource).toBe('energy');
  });

  it('Phrasenversatz folgt den Energiewechseln', () => {
    const bars: BarEnergy[] = [];
    for (let b = 0; b < 100; b++) bars.push(Math.floor((b - 4) / 8) % 2 ? bar(-5, -8, -15) : bar(-12, -20, -25));
    expect(phraseOffset(bars)).toBe(4);
  });

  it('barTime', () => {
    expect(barTime({ t0: 1, period: 0.5 }, 3)).toBe(7);
  });
});

describe('postprocess (minimal, wie Beat This!)', () => {
  it('lokale Maxima über 7 Frames, Plateaus gemittelt, Downbeats auf Beats gezogen', () => {
    const beat = new Float32Array(100).fill(-5);
    beat[10] = 3; beat[12] = 2; beat[40] = 1; beat[41] = 1; beat[70] = -1;
    expect(peakFrames(beat)).toEqual([10, 40.5]);
    const down = new Float32Array(100).fill(-5);
    down[11] = 2;
    const r = postprocess(beat, down);
    expect(r.beats).toEqual([0.2, 0.81]);
    expect(r.downbeats).toEqual([0.2]);
  });
});
