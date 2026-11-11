// Offline-Time-Stretching mit Signalsmith Stretch (WASM, MIT), ohne AudioWorklet.
// Tonhöhe bleibt, Tempo ändert sich. Ausgabe ist zeitlich auf die Eingabe ausgerichtet:
// Ausgabe-Sample j entspricht Eingabe-Sample j / factor (Latenz kompensiert).
import createModule from 'virtual:signalsmith-stretch-core';

interface StretchModule {
  HEAP8: Int8Array;
  _presetDefault(channels: number, sampleRate: number): void;
  _presetCheaper(channels: number, sampleRate: number): void;
  _reset(): void;
  _inputLatency(): number;
  _outputLatency(): number;
  _setBuffers(channels: number, length: number): number;
  _seek(inputSamples: number, playbackRate: number): void;
  _process(inputSamples: number, outputSamples: number): void;
}

let modulePromise: Promise<StretchModule> | null = null;
export function loadStretch(): Promise<StretchModule> {
  return (modulePromise ??= (createModule as () => Promise<StretchModule>)());
}

/**
 * Streckt alle Kanäle um `factor` (Ausgabedauer / Eingabedauer).
 * factor > 1 = langsamer (Track schneller als Master-Tempo).
 */
export async function stretchChannels(
  input: Float32Array[],
  sampleRate: number,
  factor: number,
  onProgress?: (fraction: number) => void,
): Promise<Float32Array[]> {
  const M = await loadStretch();
  const ch = input.length;
  const n = input[0].length;
  const outLen = Math.round(n * factor);
  if (Math.abs(factor - 1) < 1e-9) return input.map((c) => c.slice());

  M._presetDefault(ch, sampleRate);
  M._reset();
  const inLat = M._inputLatency();
  const outLat = M._outputLatency();
  const bufLen = inLat + outLat;
  const ptr = M._setBuffers(ch, bufLen);
  const inView = (c: number) => new Float32Array(M.HEAP8.buffer, ptr + bufLen * 4 * c, bufLen);
  const outView = (c: number, len: number) => new Float32Array(M.HEAP8.buffer, ptr + bufLen * 4 * (c + ch), len);
  const fill = (pos: number, count: number) => {
    for (let c = 0; c < ch; c++) {
      const b = inView(c);
      b.fill(0, 0, count);
      if (pos < n) b.set(input[c].subarray(pos, Math.min(n, pos + count)));
    }
  };

  const out = input.map(() => new Float32Array(outLen));
  const total = outLen + outLat; // die ersten outLat Ausgabe-Samples sind Latenz
  fill(0, inLat);
  M._seek(inLat, 1 / factor);
  let ip = inLat;
  let op = 0;
  const chunkIn = Math.max(64, Math.floor((bufLen / Math.max(1, factor)) * 0.5));
  let lastReport = 0;
  while (op < total) {
    let nOut = Math.min(total, Math.round((ip + chunkIn - inLat) * factor)) - op;
    if (nOut > bufLen) nOut = bufLen;
    if (nOut < 0) nOut = 0;
    fill(ip, chunkIn);
    M._process(chunkIn, nOut);
    const dst = op - outLat;
    for (let c = 0; c < ch; c++) {
      const v = outView(c, nOut);
      const from = Math.max(0, -dst);
      const to = Math.min(nOut, outLen - dst);
      if (to > from) out[c].set(v.subarray(from, to), dst + from);
    }
    ip += chunkIn;
    op += nOut;
    if (onProgress && op - lastReport > sampleRate * 10) {
      lastReport = op;
      onProgress(Math.min(1, op / total));
    }
  }
  onProgress?.(1);
  return out;
}
