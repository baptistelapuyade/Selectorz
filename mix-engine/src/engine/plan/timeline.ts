// Rezept + Analyse → exakte Zeitleiste mit Automationen. Reine Funktion.
// Das Rezept enthält nur Entscheidungen (Takte, Längen, Tempo); alle Zeiten werden hier
// abgeleitet, damit der Editor später nur das Rezept verändern muss.
import type { Envelope, MixRecipe, Timeline, TimelineTrack, TimelineTransition } from '../types';
import type { PlanTrack } from './plan';

export const BASS_CUT_DB = -40;
const FADE_STEPS = 8;
const EDGE_FADE_S = 0.01;

/** Taktzeit im Original unter Berücksichtigung der Raster-Korrektur. */
export function sourceBarTime(t: PlanTrack, gridShiftBeats: number, bar: number): number {
  return t.grid.t0 + gridShiftBeats * t.grid.period + bar * 4 * t.grid.period;
}

function fadeIn(from: number, to: number): Envelope {
  const env: Envelope = [];
  for (let i = 0; i <= FADE_STEPS; i++) {
    const x = i / FADE_STEPS;
    env.push([from + (to - from) * x, Math.sin((x * Math.PI) / 2)]);
  }
  return env;
}

function fadeOut(from: number, to: number): Envelope {
  const env: Envelope = [];
  for (let i = 0; i <= FADE_STEPS; i++) {
    const x = i / FADE_STEPS;
    env.push([from + (to - from) * x, Math.cos((x * Math.PI) / 2)]);
  }
  return env;
}

export function resolveTimeline(recipe: MixRecipe, analyses: PlanTrack[]): Timeline {
  const byId = new Map(analyses.map((a) => [a.id, a]));
  const src = recipe.tracks.map((rt) => {
    const a = byId.get(rt.id);
    if (!a) throw new Error(`Analyse für ${rt.id} fehlt`);
    return a;
  });
  const master = recipe.masterBpm;
  const beatSec = 60 / master;
  const barSec = 4 * beatSec;
  const swapRamp = beatSec / 2;

  const tracks: TimelineTrack[] = recipe.tracks.map((rt, i) => ({
    index: i,
    id: rt.id,
    stretch: src[i].bpm / master,
    sourceStart: 0,
    sourceEnd: src[i].duration,
    mixStart: 0,
    mixEnd: 0,
    gainDb: rt.gainDb,
    fader: [],
    lowShelfDb: [],
  }));

  const transitions: TimelineTransition[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i];
    const tIn = recipe.transitions.find((x) => x.from === i - 1);
    const tOut = recipe.transitions.find((x) => x.from === i);
    if (i === 0) {
      tr.sourceStart = 0;
      tr.mixStart = 0;
    }
    const mixAt = (sourceTime: number) => tr.mixStart + (sourceTime - tr.sourceStart) * tr.stretch;

    if (tOut && i + 1 < tracks.length) {
      const next = tracks[i + 1];
      const outSrc = sourceBarTime(src[i], recipe.tracks[i].gridShiftBeats, tOut.outBar);
      const start = mixAt(outSrc);
      const inSrc = sourceBarTime(src[i + 1], recipe.tracks[i + 1].gridShiftBeats, tOut.inBar);
      next.sourceStart = Math.max(0, inSrc);
      // Falls der In-Takt vor dem Dateianfang läge: Mix-Start entsprechend verschieben
      next.mixStart = start + (next.sourceStart - inSrc) * next.stretch;
      const end = start + tOut.bars * barSec;
      const bassSwap = start + tOut.bassSwapBar * barSec;
      tr.sourceEnd = Math.min(src[i].duration, sourceBarTime(src[i], recipe.tracks[i].gridShiftBeats, tOut.outBar + tOut.bars));
      tr.mixEnd = Math.min(end, mixAt(tr.sourceEnd));
      transitions.push({
        index: transitions.length,
        from: i,
        to: i + 1,
        outBar: tOut.outBar,
        inBar: tOut.inBar,
        bars: tOut.bars,
        start,
        bassSwap,
        end,
      });
    } else {
      tr.sourceEnd = src[i].duration;
      tr.mixEnd = mixAt(tr.sourceEnd);
    }

    // Fader
    const fader: Envelope = [];
    const prev = transitions.find((x) => x.to === i);
    if (prev && tIn) {
      fader.push(...fadeIn(prev.start, prev.bassSwap));
    } else {
      fader.push([tr.mixStart, 0], [tr.mixStart + EDGE_FADE_S, 1]);
    }
    const next = transitions.find((x) => x.from === i);
    if (next) fader.push(...fadeOut(next.bassSwap, next.end));
    else fader.push([tr.mixEnd - EDGE_FADE_S, 1], [tr.mixEnd, 0]);
    tr.fader = fader;

    // Bass swap (Low-Shelf)
    const low: Envelope = [];
    if (prev) low.push([prev.start, BASS_CUT_DB], [prev.bassSwap - swapRamp / 2, BASS_CUT_DB], [prev.bassSwap + swapRamp / 2, 0]);
    else low.push([tr.mixStart, 0]);
    if (next) low.push([next.bassSwap - swapRamp / 2, 0], [next.bassSwap + swapRamp / 2, BASS_CUT_DB]);
    tr.lowShelfDb = low;
  }

  const duration = tracks.reduce((m, t) => Math.max(m, t.mixEnd), 0);
  return { masterBpm: master, barSeconds: barSec, duration, tracks, transitions };
}

/** Wert eines Verlaufs zu einem Zeitpunkt (stückweise linear, außen konstant). */
export function evalEnvelope(env: Envelope, t: number): number {
  if (!env.length) return 0;
  if (t <= env[0][0]) return env[0][1];
  for (let i = 1; i < env.length; i++) {
    const [t1, v1] = env[i];
    if (t <= t1) {
      const [t0, v0] = env[i - 1];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return env[env.length - 1][1];
}

/** Takt eines Tracks → Mix-Zeit (z. B. für die Tracklist oder Sprungmarken). */
export function mixTimeOfBar(tl: Timeline, recipe: MixRecipe, analyses: PlanTrack[], trackIndex: number, bar: number): number {
  const a = analyses.find((x) => x.id === recipe.tracks[trackIndex].id)!;
  const tr = tl.tracks[trackIndex];
  return tr.mixStart + (sourceBarTime(a, recipe.tracks[trackIndex].gridShiftBeats, bar) - tr.sourceStart) * tr.stretch;
}
