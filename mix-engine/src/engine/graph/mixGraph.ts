// Ein Web-Audio-Graph für Vorschau (AudioContext) und Export (OfflineAudioContext).
// Beide bauen exakt denselben Graphen aus derselben Zeitleiste und denselben vorab
// gestreckten Puffern (Umsetzungsplan G3 / 3.4).
//
//   Quelle → Trim (Lautheit) → Low-Shelf (Bass swap) → Fader ─┐
//   Quelle → …                                               ├→ Summe → Limiter → Ausgang
import type { Envelope, Timeline } from '../types';
import { evalEnvelope } from '../plan/timeline';

/** Vorab gestreckter Track. Der Puffer beginnt bei `coverStart` (Sekunden im Original). */
export interface StretchedTrack {
  id: string;
  buffer: AudioBuffer;
  coverStart: number;
  coverEnd: number;
  stretch: number;
}

export const MASTER = {
  preGainDb: -2,
  lowShelfHz: 180,
  limiter: { threshold: -2, knee: 1, ratio: 20, attack: 0.001, release: 0.12 },
  postGainDb: -0.5, // Reserve: der Kompressor hebt mit Make-up-Gain leicht an
};

const dbToGain = (db: number) => Math.pow(10, db / 20);

export interface GraphWindow {
  /** Mix-Zeit, ab der gerendert/abgespielt wird (Sekunden). */
  mixFrom: number;
  /** Mix-Zeit, bis zu der Quellen eingeplant werden. */
  mixTo: number;
  /** Kontext-Zeit, die `mixFrom` entspricht. */
  ctxStart: number;
}

export interface MixGraph {
  output: AudioNode;
  sources: AudioBufferSourceNode[];
  disconnect(): void;
}

/** Plant einen Verlauf ab `mixFrom` als AudioParam-Automation ein. */
export function scheduleEnvelope(param: AudioParam, env: Envelope, w: GraphWindow, map: (v: number) => number = (v) => v) {
  const toCtx = (t: number) => w.ctxStart + (t - w.mixFrom);
  param.cancelScheduledValues(0);
  param.setValueAtTime(map(evalEnvelope(env, w.mixFrom)), w.ctxStart);
  for (const [t, v] of env) {
    if (t <= w.mixFrom) continue;
    param.linearRampToValueAtTime(map(v), toCtx(t));
    // den ersten Punkt hinter dem Fenster noch setzen, sonst fehlt die laufende Rampe
    if (t >= w.mixTo) break;
  }
}

/** Prüft, ob ein gestreckter Puffer den von der Zeitleiste benötigten Bereich abdeckt. */
/** Toleranz für Rundungen beim Dekodieren in verschiedenen Abtastraten (Dateiende). */
const COVER_TOLERANCE_S = 0.05;

export function covers(media: StretchedTrack, sourceStart: number, sourceEnd: number, stretch: number): boolean {
  return (
    Math.abs(media.stretch - stretch) < 1e-12 &&
    media.coverStart <= sourceStart + COVER_TOLERANCE_S &&
    media.coverEnd >= sourceEnd - COVER_TOLERANCE_S
  );
}

/** Render-Quantum der Web Audio API. Fenster beginnen immer auf Vielfachen davon. */
export const QUANTUM = 128;
export const alignDown = (frame: number) => Math.floor(frame / QUANTUM) * QUANTUM;

export function buildMixGraph(ctx: BaseAudioContext, tl: Timeline, media: Map<string, StretchedTrack>, w: GraphWindow): MixGraph {
  // Alles in ganzen Frames rechnen: so liest jede Quelle in jedem Fenster exakt dieselben
  // Samples (keine Interpolation), und Live/Export/Abschnitte rechnen identisch.
  const sr = ctx.sampleRate;
  const fromF = Math.round(w.mixFrom * sr);
  const toF = Math.round(w.mixTo * sr);
  const ctxF = Math.round(w.ctxStart * sr);
  const sum = new GainNode(ctx, { gain: dbToGain(MASTER.preGainDb) });
  const limiter = new DynamicsCompressorNode(ctx, MASTER.limiter);
  const post = new GainNode(ctx, { gain: dbToGain(MASTER.postGainDb) });
  sum.connect(limiter).connect(post);
  const nodes: AudioNode[] = [sum, limiter, post];
  const sources: AudioBufferSourceNode[] = [];

  for (const tr of tl.tracks) {
    const startF = Math.round(tr.mixStart * sr);
    const endF = Math.round(tr.mixEnd * sr);
    const aF = Math.max(fromF, startF);
    const bF = Math.min(toF, endF);
    if (bF <= aF) continue;
    const m = media.get(tr.id);
    if (!m) throw new Error(`Gestreckter Puffer für ${tr.id} fehlt`);
    if (!covers(m, tr.sourceStart, tr.sourceEnd, tr.stretch)) throw new Error(`Puffer für ${tr.id} deckt den Bereich nicht ab`);
    const bufAtStartF = Math.round((tr.sourceStart - m.coverStart) * m.stretch * sr);

    const src = new AudioBufferSourceNode(ctx, { buffer: m.buffer });
    const trim = new GainNode(ctx, { gain: dbToGain(tr.gainDb) });
    const low = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: MASTER.lowShelfHz, gain: 0 });
    const fader = new GainNode(ctx, { gain: 0 });
    src.connect(trim).connect(low).connect(fader).connect(sum);
    scheduleEnvelope(low.gain, tr.lowShelfDb, w);
    scheduleEnvelope(fader.gain, tr.fader, w);
    src.start((ctxF + aF - fromF) / sr, (bufAtStartF + aF - startF) / sr, (bF - aF) / sr);
    sources.push(src);
    nodes.push(src, trim, low, fader);
  }

  return {
    output: post,
    sources,
    disconnect() {
      for (const s of sources) {
        try { s.stop(); } catch { /* schon gestoppt */ }
      }
      nodes.forEach((n) => n.disconnect());
    },
  };
}
