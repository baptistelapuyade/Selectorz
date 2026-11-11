// „Minimal“-Postprocessing von Beat This! (ohne DBN): lokale Maxima über 7 Frames mit
// Logit > 0, benachbarte Peaks zusammenfassen, Downbeats auf den nächsten Beat ziehen.
import { FPS } from './features';

export function peakFrames(logits: Float32Array): number[] {
  const peaks: number[] = [];
  const n = logits.length;
  for (let i = 0; i < n; i++) {
    const v = logits[i];
    if (!(v > 0)) continue;
    let isMax = true;
    for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) {
      if (logits[j] > v) { isMax = false; break; }
    }
    if (isMax) peaks.push(i);
  }
  // Plateaus/Nachbarn (Abstand 1) zu ihrem Mittelwert zusammenfassen (deduplicate_peaks, width=1)
  const out: number[] = [];
  for (let i = 0; i < peaks.length; ) {
    let j = i + 1;
    let mean = peaks[i];
    while (j < peaks.length && peaks[j] - mean <= 1) {
      mean += (peaks[j] - mean) / (j - i + 1);
      j++;
    }
    let sum = 0;
    for (let k = i; k < j; k++) sum += peaks[k];
    out.push(sum / (j - i));
    i = j;
  }
  return out;
}

export function postprocess(beatLogits: Float32Array, downbeatLogits: Float32Array): { beats: number[]; downbeats: number[] } {
  const beats = peakFrames(beatLogits).map((f) => f / FPS);
  const raw = peakFrames(downbeatLogits).map((f) => f / FPS);
  if (!beats.length) return { beats, downbeats: [] };
  const snapped = new Set<number>();
  for (const d of raw) {
    let best = beats[0];
    for (const b of beats) if (Math.abs(b - d) < Math.abs(best - d)) best = b;
    snapped.add(best);
  }
  return { beats, downbeats: [...snapped].sort((a, b) => a - b) };
}
