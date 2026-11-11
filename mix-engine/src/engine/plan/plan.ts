// Auto-Mix-Planung (Umsetzungsplan 3.3) als reine Funktion: Analyse → Rezept.
// Keine Seiteneffekte, kein Audio, deterministisch.
import { ENGINE_VERSION, type MasterTempoMode, type MixRecipe, type RecipeTransition, type TrackAnalysis } from '../types';

export type PlanTrack = Pick<
  TrackAnalysis,
  'id' | 'title' | 'bpm' | 'duration' | 'grid' | 'phraseBars' | 'phraseOffset' | 'introEndBar' | 'outroStartBar' | 'loudness'
>;

export interface PlanOptions {
  masterTempo: MasterTempoMode | number;
  transitionBars: 'auto' | 8 | 16 | 32 | 64;
  /** Hinweis ab dieser Streckung (Prozent). */
  stretchWarnPct: number;
  /** Lautheitsangleichung: maximale Anhebung/Absenkung in dB. */
  maxBoostDb: number;
  maxCutDb: number;
}

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  masterTempo: 'median',
  transitionBars: 'auto',
  stretchWarnPct: 6,
  maxBoostDb: 6,
  maxCutDb: 12,
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Master-Tempo nach Modus. „minimax“ minimiert die größte relative Streckung. */
export function masterTempo(bpms: number[], mode: MasterTempoMode | number): number {
  if (typeof mode === 'number') return mode;
  if (!bpms.length) return 120;
  if (mode === 'first') return bpms[0];
  if (mode === 'median') return median(bpms);
  return (Math.min(...bpms) + Math.max(...bpms)) / 2;
}

export function phraseStarts(t: Pick<PlanTrack, 'phraseOffset' | 'phraseBars' | 'grid'>): number[] {
  const out: number[] = [];
  for (let p = t.phraseOffset; p < t.grid.barCount; p += t.phraseBars) out.push(p);
  return out;
}

function chooseLength(a: PlanTrack, b: PlanTrack, opt: PlanOptions['transitionBars']): number {
  if (opt !== 'auto') return opt;
  const outroLen = a.grid.barCount - a.outroStartBar;
  const introLen = b.introEndBar - b.phraseOffset;
  return outroLen >= 32 && introLen >= 32 ? 32 : 16;
}

/** In-Takt: so, dass der Übergang endet, wenn das Intro des kommenden Tracks endet. */
function chooseIn(b: PlanTrack, bars: number): number {
  const starts = phraseStarts(b).filter((p) => p + bars <= b.grid.barCount);
  if (!starts.length) return 0;
  const target = b.introEndBar - bars;
  const below = starts.filter((p) => p <= target);
  return below.length ? below[below.length - 1] : starts[0];
}

/** Out-Takt: Phrasenanfang im letzten Drittel, möglichst am Outro-Beginn. */
function chooseOut(a: PlanTrack, bars: number, minBar: number, warnings: string[]): number | null {
  const cands = phraseStarts(a).filter((p) => p >= minBar && p + bars <= a.grid.barCount);
  if (!cands.length) return null;
  const lastThird = Math.ceil((2 / 3) * a.grid.barCount);
  const late = cands.filter((p) => p >= lastThird);
  if (late.includes(a.outroStartBar)) return a.outroStartBar;
  if (late.length) {
    return late.reduce((best, p) => (Math.abs(p - a.outroStartBar) < Math.abs(best - a.outroStartBar) ? p : best), late[0]);
  }
  warnings.push(`„${a.title}“: kein Out-Punkt im letzten Drittel, nehme Takt ${cands[cands.length - 1]}.`);
  return cands[cands.length - 1];
}

export function plan(tracks: PlanTrack[], options: Partial<PlanOptions> = {}): MixRecipe {
  const opt = { ...DEFAULT_PLAN_OPTIONS, ...options };
  const warnings: string[] = [];
  const bpms = tracks.map((t) => t.bpm);
  const master = masterTempo(bpms, opt.masterTempo);

  // Tempo-Hinweise (G5): ab ca. 6 % Streckung
  for (const t of tracks) {
    const pct = (t.bpm / master - 1) * 100;
    if (Math.abs(pct) >= opt.stretchWarnPct) {
      warnings.push(`„${t.title}“: ${t.bpm.toFixed(2)} BPM → ${master.toFixed(2)} BPM ist eine Streckung um ${pct > 0 ? '+' : ''}${pct.toFixed(1)} %.`);
    }
    if (t.grid.residualMs > 15 || t.grid.inlierShare < 0.8) {
      warnings.push(`„${t.title}“: Beat-Raster unsicher (Abweichung ${t.grid.residualMs.toFixed(0)} ms, ${(t.grid.inlierShare * 100).toFixed(0)} % passend). Tempowechsel?`);
    }
    if (t.grid.downbeatConfidence < 0.6) {
      warnings.push(`„${t.title}“: erster Schlag unsicher (${(t.grid.downbeatConfidence * 100).toFixed(0)} %).`);
    }
  }
  if (tracks.length > 1) {
    const mm = masterTempo(bpms, 'minimax');
    const worst = (m: number) => Math.max(...bpms.map((b) => Math.abs(b / m - 1)));
    if (worst(master) * 100 >= opt.stretchWarnPct && worst(mm) < worst(master) - 1e-6) {
      warnings.push(`Tempo-Vorschlag: ${mm.toFixed(2)} BPM hält die größte Streckung bei ${(worst(mm) * 100).toFixed(1)} %.`);
    }
  }

  // Lautheit angleichen: auf den Median, begrenzt
  const finite = tracks.map((t) => t.loudness).filter(Number.isFinite);
  const target = finite.length ? Math.max(-14, Math.min(-8, median(finite))) : -10;
  const recipeTracks = tracks.map((t) => {
    const g = Number.isFinite(t.loudness) ? target - t.loudness : 0;
    return { id: t.id, title: t.title, bpm: t.bpm, gainDb: Math.max(-opt.maxCutDb, Math.min(opt.maxBoostDb, g)), gridShiftBeats: 0 };
  });

  const transitions: RecipeTransition[] = [];
  let minOut = 0; // frühester Out-Takt des aktuellen Tracks (nach seinem Einstieg)
  for (let i = 0; i + 1 < tracks.length; i++) {
    const a = tracks[i];
    const b = tracks[i + 1];
    let bars = chooseLength(a, b, opt.transitionBars);
    let outBar: number | null = null;
    let inBar = 0;
    for (; bars >= 8; bars /= 2) {
      inBar = chooseIn(b, bars);
      outBar = chooseOut(a, bars, minOut, warnings);
      if (outBar !== null && inBar + bars <= b.grid.barCount) break;
    }
    if (outBar === null || bars < 8) {
      bars = 8;
      outBar = Math.max(minOut, a.grid.barCount - bars);
      inBar = 0;
      warnings.push(`„${a.title}“ → „${b.title}“: zu kurz für einen Übergang an einer Phrase.`);
    }
    transitions.push({ from: i, outBar, inBar, bars, bassSwapBar: bars / 2, bassSwap: true, style: 'blend', edited: false });
    minOut = inBar + bars;
  }

  return {
    engine: ENGINE_VERSION,
    masterTempoMode: typeof opt.masterTempo === 'number' ? 'manual' : opt.masterTempo,
    masterBpm: master,
    tracks: recipeTracks,
    transitions,
    targetLoudness: target,
    warnings,
  };
}
