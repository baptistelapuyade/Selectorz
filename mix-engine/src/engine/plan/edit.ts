// Bearbeiten des Rezepts (Vorstufe des Übergangs-Editors, Screen 3 „Shape“).
// Reine Funktionen: altes Rezept rein, neues Rezept oder Fehlertext raus. Alles rastet auf
// ganze Takte ein; Zeiten leitet danach resolveTimeline() ab, gestreckt wird nicht neu.
import type { MixRecipe, RecipeTransition, TransitionStyle } from '../types';
import type { PlanTrack } from './plan';

export const ALLOWED_BARS = [8, 16, 32, 64] as const;

export interface TransitionPatch {
  /** Out-Takt um so viele Takte verschieben. */
  outBarDelta?: number;
  /** In-Takt um so viele Takte verschieben. */
  inBarDelta?: number;
  bars?: (typeof ALLOWED_BARS)[number];
  style?: TransitionStyle;
  bassSwap?: boolean;
}

export type EditResult = { ok: true; recipe: MixRecipe } | { ok: false; error: string };

function barCountOf(recipe: MixRecipe, analyses: PlanTrack[], index: number): number {
  const rt = recipe.tracks[index];
  const a = analyses.find((x) => x.id === rt.id);
  if (!a) throw new Error(`Analyse für ${rt.id} fehlt`);
  // Raster-Korrektur verschiebt Takt 0; danach zählen nur vollständige Takte bis Dateiende
  const t0 = a.grid.t0 + rt.gridShiftBeats * a.grid.period;
  return Math.max(0, Math.floor((a.duration - t0) / (4 * a.grid.period) + 1e-6));
}

/** Prüft alle Übergänge auf Grenzen und Überlappung. */
export function validateRecipe(recipe: MixRecipe, analyses: PlanTrack[]): string | null {
  const ts = [...recipe.transitions].sort((a, b) => a.from - b.from);
  for (const t of ts) {
    const nA = barCountOf(recipe, analyses, t.from);
    const nB = barCountOf(recipe, analyses, t.from + 1);
    const titleA = recipe.tracks[t.from].title;
    const titleB = recipe.tracks[t.from + 1].title;
    if (!ALLOWED_BARS.includes(t.bars as (typeof ALLOWED_BARS)[number])) return `Länge ${t.bars} Takte ist nicht erlaubt.`;
    if (t.outBar < 0 || t.outBar + t.bars > nA) return `„${titleA}“ hat nur ${nA} Takte; Out-Takt ${t.outBar} + ${t.bars} passt nicht.`;
    if (t.inBar < 0 || t.inBar + t.bars > nB) return `„${titleB}“ hat nur ${nB} Takte; In-Takt ${t.inBar} + ${t.bars} passt nicht.`;
    if (t.bassSwapBar < 0 || t.bassSwapBar > t.bars) return 'Bass swap liegt außerhalb des Übergangs.';
    const prev = ts.find((x) => x.from === t.from - 1);
    if (prev && t.outBar < prev.inBar + prev.bars) {
      return `„${titleA}“: Der Übergang raus (Takt ${t.outBar}) beginnt, bevor der Übergang rein endet (Takt ${prev.inBar + prev.bars}).`;
    }
  }
  return null;
}

export function editTransition(recipe: MixRecipe, analyses: PlanTrack[], index: number, patch: TransitionPatch): EditResult {
  const old = recipe.transitions[index];
  if (!old) return { ok: false, error: `Übergang ${index + 1} gibt es nicht.` };
  const t: RecipeTransition = { ...old, edited: true };
  if (patch.outBarDelta) t.outBar += patch.outBarDelta;
  if (patch.inBarDelta) t.inBar += patch.inBarDelta;
  if (patch.bars !== undefined && patch.bars !== t.bars) {
    t.bars = patch.bars;
    t.bassSwapBar = patch.bars / 2;
  }
  if (patch.style) t.style = patch.style;
  if (patch.bassSwap !== undefined) t.bassSwap = patch.bassSwap;
  const next: MixRecipe = { ...recipe, transitions: recipe.transitions.map((x, i) => (i === index ? t : x)) };
  const err = validateRecipe(next, analyses);
  return err ? { ok: false, error: err } : { ok: true, recipe: next };
}

/**
 * „Set the one here“: verschiebt das Raster eines Tracks um ganze Beats.
 * Positive Werte = die Eins liegt später.
 */
export function shiftGrid(recipe: MixRecipe, analyses: PlanTrack[], trackIndex: number, beats: number): EditResult {
  if (!recipe.tracks[trackIndex]) return { ok: false, error: `Track ${trackIndex + 1} gibt es nicht.` };
  const tracks = recipe.tracks.map((t, i) => (i === trackIndex ? { ...t, gridShiftBeats: t.gridShiftBeats + beats } : t));
  const next: MixRecipe = { ...recipe, tracks };
  const a = analyses.find((x) => x.id === tracks[trackIndex].id)!;
  if (a.grid.t0 + tracks[trackIndex].gridShiftBeats * a.grid.period < 0) return { ok: false, error: 'Die Eins kann nicht vor dem Dateianfang liegen.' };
  const err = validateRecipe(next, analyses);
  return err ? { ok: false, error: err } : { ok: true, recipe: next };
}
