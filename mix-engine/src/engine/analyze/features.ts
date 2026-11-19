// Log-Mel-Spektrogramm exakt nach Beat This! (torchaudio.MelSpectrogram):
// 22 050 Hz, n_fft 1024, Hop 441 (50 fps), periodisches Hann-Fenster, center=True mit
// Reflect-Padding, Betrag (power=1), normalized="frame_length" (÷√1024),
// 128 Slaney-Mel-Bänder 30–11 000 Hz ohne Flächennormierung, dann log1p(1000·x).
// Nebenbei: Leistung pro Frame in drei Bändern (für Energie pro Takt).
import { FFT } from '../dsp/fft';

export const SAMPLE_RATE = 22050;
export const HOP = 441;
export const N_FFT = 1024;
export const N_MELS = 128;
export const FPS = SAMPLE_RATE / HOP; // 50

/** Bandgrenzen für die Energie pro Takt (Hz). */
export const BAND_EDGES = { lowMin: 30, lowMax: 150, midMax: 2500, highMax: 11025 };

function hzToMelSlaney(f: number): number {
  const fSp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = minLogHz / fSp;
  const logStep = Math.log(6.4) / 27;
  return f >= minLogHz ? minLogMel + Math.log(f / minLogHz) / logStep : f / fSp;
}

function melToHzSlaney(m: number): number {
  const fSp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = minLogHz / fSp;
  const logStep = Math.log(6.4) / 27;
  return m >= minLogMel ? minLogHz * Math.exp(logStep * (m - minLogMel)) : fSp * m;
}

export interface MelFilter {
  start: number; // erster Bin
  weights: Float32Array;
}

/** Wie torchaudio.functional.melscale_fbanks(norm=None, mel_scale="slaney"). */
export function melFilterbank(
  sampleRate = SAMPLE_RATE,
  nFft = N_FFT,
  nMels = N_MELS,
  fMin = 30,
  fMax = 11000,
): MelFilter[] {
  const nFreqs = nFft / 2 + 1;
  const nyq = Math.floor(sampleRate / 2);
  const allFreqs = new Float64Array(nFreqs);
  for (let i = 0; i < nFreqs; i++) allFreqs[i] = (nyq * i) / (nFreqs - 1);
  const mMin = hzToMelSlaney(fMin);
  const mMax = hzToMelSlaney(fMax);
  const fPts = new Float64Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i++) fPts[i] = melToHzSlaney(mMin + ((mMax - mMin) * i) / (nMels + 1));
  const filters: MelFilter[] = [];
  for (let m = 0; m < nMels; m++) {
    const lo = fPts[m];
    const mid = fPts[m + 1];
    const hi = fPts[m + 2];
    const w: number[] = [];
    let start = -1;
    for (let k = 0; k < nFreqs; k++) {
      const down = (allFreqs[k] - lo) / (mid - lo);
      const up = (hi - allFreqs[k]) / (hi - mid);
      const v = Math.max(0, Math.min(down, up));
      if (v > 0) {
        if (start < 0) start = k;
        w[k - start] = v;
      } else if (start >= 0) {
        break;
      }
    }
    filters.push({ start: Math.max(0, start), weights: Float32Array.from(w.map((x) => x ?? 0)) });
  }
  return filters;
}

export interface Features {
  /** Frames × 128, zeilenweise. */
  mel: Float32Array;
  frames: number;
  /** Leistung pro Frame in den drei Bändern (linear). */
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
}

let cachedFilters: MelFilter[] | null = null;

/** Merkmale aus Mono-PCM bei 22 050 Hz. */
export function extractFeatures(pcm: Float32Array): Features {
  const n = pcm.length;
  const frames = Math.floor(n / HOP) + 1;
  const fft = new FFT(N_FFT);
  const filters = (cachedFilters ??= melFilterbank());
  const window = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  const mag = new Float64Array(N_FFT / 2 + 1);
  const mel = new Float32Array(frames * N_MELS);
  const low = new Float32Array(frames);
  const mid = new Float32Array(frames);
  const high = new Float32Array(frames);
  const norm = 1 / Math.sqrt(N_FFT);
  const binHz = SAMPLE_RATE / N_FFT;
  const lowA = Math.ceil(BAND_EDGES.lowMin / binHz);
  const lowB = Math.floor(BAND_EDGES.lowMax / binHz);
  const midB = Math.floor(BAND_EDGES.midMax / binHz);
  const half = N_FFT / 2;

  for (let f = 0; f < frames; f++) {
    const center = f * HOP;
    for (let i = 0; i < N_FFT; i++) {
      let idx = center - half + i;
      if (idx < 0) idx = -idx; // reflect
      if (idx >= n) idx = 2 * n - 2 - idx;
      const s = idx >= 0 && idx < n ? pcm[idx] : 0;
      re[i] = s * window[i];
      im[i] = 0;
    }
    fft.transform(re, im);
    let pl = 0;
    let pm = 0;
    let ph = 0;
    for (let k = 0; k <= half; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      mag[k] = Math.sqrt(p) * norm;
      if (k >= lowA && k <= lowB) pl += p;
      else if (k > lowB && k <= midB) pm += p;
      else if (k > midB) ph += p;
    }
    low[f] = pl;
    mid[f] = pm;
    high[f] = ph;
    const row = f * N_MELS;
    for (let m = 0; m < N_MELS; m++) {
      const { start, weights } = filters[m];
      let v = 0;
      for (let j = 0; j < weights.length; j++) v += mag[start + j] * weights[j];
      mel[row + m] = Math.log1p(1000 * v);
    }
  }
  return { mel, frames, low, mid, high };
}
