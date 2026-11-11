// Export in Abschnitten (3.5): jeder Abschnitt ist ein eigener OfflineAudioContext mit
// Vorlauf, damit Filter- und Limiter-Zustände an den Nahtstellen eingeschwungen sind.
// So liegt nie der ganze Mix als Float32 im Speicher.
import type { Timeline } from '../types';
import { alignDown, buildMixGraph, QUANTUM, type StretchedTrack } from '../graph/mixGraph';

export interface RenderOptions {
  sampleRate: number;
  from?: number;
  to?: number;
  sectionSec?: number;
  prerollSec?: number;
  onSection?: (chunk: Float32Array[], index: number, count: number) => void | Promise<void>;
}

export interface RenderStats {
  ms: number;
  sections: number;
  frames: number;
  /** Größter Abschnittspuffer (Bytes), als grobes Maß für den Spitzenbedarf beim Rendern. */
  peakSectionBytes: number;
}

export async function renderMix(tl: Timeline, media: Map<string, StretchedTrack>, opt: RenderOptions): Promise<RenderStats> {
  const sr = opt.sampleRate;
  // Fensteranfänge, Abschnitte und Vorlauf auf Render-Quanten ausrichten
  const fromF = alignDown(Math.round((opt.from ?? 0) * sr));
  const toF = Math.round((opt.to ?? tl.duration) * sr);
  const secF = Math.max(QUANTUM, alignDown(Math.round((opt.sectionSec ?? 30) * sr)));
  const preF = alignDown(Math.round((opt.prerollSec ?? 2) * sr));
  const count = Math.ceil((toF - fromF) / secF);
  const t = performance.now();
  let peakSectionBytes = 0;
  for (let k = 0; k < count; k++) {
    const s = fromF + k * secF;
    const e = Math.min(toF, s + secF);
    const pre = preF;
    const len = pre + (e - s);
    const ctx = new OfflineAudioContext(2, len, sr);
    const g = buildMixGraph(ctx, tl, media, { mixFrom: (s - pre) / sr, mixTo: e / sr, ctxStart: 0 });
    g.output.connect(ctx.destination);
    const out = await ctx.startRendering();
    peakSectionBytes = Math.max(peakSectionBytes, len * 2 * 4);
    const chunk = [out.getChannelData(0).subarray(pre), out.getChannelData(1).subarray(pre)];
    await opt.onSection?.(chunk, k, count);
  }
  return { ms: performance.now() - t, sections: count, frames: toF - fromF, peakSectionBytes };
}

/** Rendert einen Bereich vollständig in den Speicher (für Tests und Vergleiche). */
export async function renderToArrays(
  tl: Timeline,
  media: Map<string, StretchedTrack>,
  opt: Omit<RenderOptions, 'onSection'>,
): Promise<Float32Array[]> {
  const sr = opt.sampleRate;
  const frames = Math.round((opt.to ?? tl.duration) * sr) - alignDown(Math.round((opt.from ?? 0) * sr));
  const out = [new Float32Array(frames), new Float32Array(frames)];
  let pos = 0;
  await renderMix(tl, media, {
    ...opt,
    onSection: (chunk) => {
      out[0].set(chunk[0].subarray(0, frames - pos), pos);
      out[1].set(chunk[1].subarray(0, frames - pos), pos);
      pos += chunk[0].length;
    },
  });
  return out;
}

export interface DiffStats {
  frames: number;
  maxAbs: number;
  /** Position der größten Abweichung (Sekunden ab Fensteranfang). */
  maxAtSec: number;
  maxDb: number;
  rmsDb: number;
  /** Pegel des Signals selbst (RMS, dBFS) als Bezug. */
  signalRmsDb: number;
}

export function diffStats(a: Float32Array[], b: Float32Array[], skip = 0, sampleRate = 44100): DiffStats {
  const n = Math.min(a[0].length, b[0].length);
  let maxAbs = 0, maxAt = 0, se = 0, ss = 0, cnt = 0;
  for (let c = 0; c < Math.min(a.length, b.length); c++) {
    for (let i = skip; i < n; i++) {
      const d = a[c][i] - b[c][i];
      const ad = Math.abs(d);
      if (ad > maxAbs) { maxAbs = ad; maxAt = i; }
      se += d * d;
      ss += a[c][i] * a[c][i];
      cnt++;
    }
  }
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { frames: n - skip, maxAbs, maxAtSec: maxAt / sampleRate, maxDb: db(maxAbs), rmsDb: db(Math.sqrt(se / Math.max(1, cnt))), signalRmsDb: db(Math.sqrt(ss / Math.max(1, cnt))) };
}

/** Gleichheitstest: ein Bereich am Stück gerendert vs. in kurzen Abschnitten. */
export async function sectionEquality(tl: Timeline, media: Map<string, StretchedTrack>, sampleRate: number, from: number, seconds: number) {
  const whole = await renderToArrays(tl, media, { sampleRate, from, to: from + seconds, sectionSec: seconds, prerollSec: 2 });
  const parts = await renderToArrays(tl, media, { sampleRate, from, to: from + seconds, sectionSec: seconds / 4, prerollSec: 2 });
  return diffStats(whole, parts);
}
