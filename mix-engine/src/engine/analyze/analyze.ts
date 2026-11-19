// Analyse eines Tracks aus Mono-PCM (22 050 Hz). Läuft im Worker.
import type { AnalysisTimings, TrackAnalysis } from '../types';
import { inferLogits, type LoadedModel } from './beatthis';
import { extractFeatures, SAMPLE_RATE } from './features';
import { applyPhaseShift, barEnergies, chooseBarPhase, detectSections, fitGrid, medianBpm, phraseOffset, refinePhase } from './grid';
import { integratedLoudness } from './loudness';
import { postprocess } from './postprocess';

export interface AnalyzeInput {
  id: string;
  title: string;
  pcm: Float32Array; // mono, 22 050 Hz
  decodeMs: number;
}

export const PHRASE_BARS = 8;

export async function analyzeTrack(
  input: AnalyzeInput,
  model: LoadedModel,
  onProgress?: (stage: string, done: number, total: number) => void,
): Promise<TrackAnalysis> {
  const t0 = performance.now();
  const duration = input.pcm.length / SAMPLE_RATE;

  onProgress?.('features', 0, 1);
  const feats = extractFeatures(input.pcm);
  const loudness = integratedLoudness(input.pcm, SAMPLE_RATE);
  const t1 = performance.now();

  const logits = await inferLogits(model, feats.mel, feats.frames, (d, t) => onProgress?.('inference', d, t));
  const t2 = performance.now();

  const { beats, downbeats } = postprocess(logits.beat, logits.downbeat);
  const rough = fitGrid(beats, downbeats, duration);
  const fineShift = rough ? refinePhase(input.pcm, SAMPLE_RATE, rough) : 0;
  const t3 = performance.now();

  const timings: AnalysisTimings = {
    decodeMs: input.decodeMs,
    featuresMs: t1 - t0,
    inferenceMs: t2 - t1,
    postMs: t3 - t2,
    totalMs: t3 - t0,
    modelLoadMs: 0,
  };
  return deriveAnalysis({
    id: input.id,
    title: input.title,
    duration,
    model: model.size,
    executionProvider: model.ep,
    beats,
    downbeats,
    loudness,
    timings,
    raw: { low: feats.low, mid: feats.mid, high: feats.high, fineShift },
  });
}

export type RawAnalysis = Pick<
  TrackAnalysis,
  'id' | 'title' | 'duration' | 'model' | 'executionProvider' | 'beats' | 'downbeats' | 'loudness' | 'timings' | 'fromCache'
> & { raw: NonNullable<TrackAnalysis['raw']> };

/**
 * Alles, was nach der Inferenz kommt (Raster, Eins, Phrasen, Intro/Outro), als reine
 * Funktion. Läuft im Worker und erneut beim Laden aus dem Cache, damit Verbesserungen an
 * diesen Schritten ohne neue Inferenz greifen.
 */
export function deriveAnalysis(r: RawAnalysis): TrackAnalysis {
  const { low, mid, high, fineShift } = r.raw;
  const rough = fitGrid(r.beats, r.downbeats, r.duration);
  let grid = rough
    ? applyPhaseShift(rough, fineShift, r.duration)
    : { t0: 0, period: 0.5, beatsPerBar: 4 as const, barCount: Math.floor(r.duration / 2), residualMs: NaN, inlierShare: 0, downbeatConfidence: 0, phaseShiftMs: 0 };
  let barPhaseSource: TrackAnalysis['barPhaseSource'] = 'model';
  if (rough) {
    const c = chooseBarPhase(grid, low, mid, high, r.duration);
    if (c.changed) { grid = c.grid; barPhaseSource = 'phrases'; }
  }
  const bars = barEnergies(grid, low, mid, high);
  const offset = phraseOffset(bars, PHRASE_BARS);
  const sections = detectSections(bars, offset, PHRASE_BARS);
  return {
    ...r,
    bpm: 60 / grid.period,
    bpmMedian: r.beats.length > 1 ? medianBpm(r.beats) : NaN,
    grid,
    barPhaseSource,
    phraseBars: PHRASE_BARS,
    phraseOffset: offset,
    bars,
    ...sections,
  };
}

/** Vergleich zweier Analysen desselben Tracks (z. B. kleines vs. großes Modell). */
export function compareAnalyses(a: TrackAnalysis, b: TrackAnalysis, tol = 0.07) {
  const match = (x: number[], y: number[]) => {
    let hits = 0;
    let j = 0;
    for (const t of x) {
      while (j < y.length && y[j] < t - tol) j++;
      if (j < y.length && Math.abs(y[j] - t) <= tol) hits++;
    }
    return hits;
  };
  const f = (x: number[], y: number[]) => {
    if (!x.length && !y.length) return 1;
    const h = match(x, y);
    const p = h / Math.max(1, x.length);
    const r = h / Math.max(1, y.length);
    return p + r ? (2 * p * r) / (p + r) : 0;
  };
  return {
    beatF: f(a.beats, b.beats),
    downbeatF: f(a.downbeats, b.downbeats),
    bpmDiff: a.bpm - b.bpm,
    t0DiffMs: (a.grid.t0 - b.grid.t0) * 1000,
  };
}
