// Datei → PCM. decodeAudioData ist nur im Haupt-Thread verfügbar (kein AudioContext im
// Worker); der Browser dekodiert intern trotzdem außerhalb des UI-Threads. Für AIFF, das
// Chrome/Firefox nicht dekodieren, springt der eigene Parser ein; das Resampling übernimmt
// dann ein OfflineAudioContext.
import type { Pcm } from '../types';
import { isAiff, parseAiff } from './aiff';

export const SUPPORTED = ['mp3', 'wav', 'aif', 'aiff', 'flac', 'm4a', 'aac', 'ogg'];

export class DecodeError extends Error {}

async function resample(pcm: Pcm, targetRate: number): Promise<Pcm> {
  if (pcm.sampleRate === targetRate) return pcm;
  const frames = Math.ceil((pcm.channels[0].length * targetRate) / pcm.sampleRate);
  const ctx = new OfflineAudioContext(pcm.channels.length, frames, targetRate);
  const buf = new AudioBuffer({ length: pcm.channels[0].length, numberOfChannels: pcm.channels.length, sampleRate: pcm.sampleRate });
  pcm.channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  const src = new AudioBufferSourceNode(ctx, { buffer: buf });
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return { sampleRate: targetRate, channels: Array.from({ length: out.numberOfChannels }, (_, i) => out.getChannelData(i)) };
}

/** Dekodiert und resampelt auf `targetRate`. Kanäle wie in der Datei (1 oder 2). */
export async function decodeFile(file: Blob, targetRate: number): Promise<Pcm> {
  const bytes = await file.arrayBuffer();
  const aiff = isAiff(bytes);
  const ctx = new OfflineAudioContext(1, 1, targetRate);
  try {
    // decodeAudioData löst den Puffer ab; für den AIFF-Fallback eine Kopie behalten
    const buf = await ctx.decodeAudioData(aiff ? bytes.slice(0) : bytes);
    return { sampleRate: buf.sampleRate, channels: Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)) };
  } catch (err) {
    if (!aiff) throw new DecodeError(`Datei nicht lesbar: ${err instanceof Error ? err.message : String(err)}`);
  }
  return resample(parseAiff(bytes), targetRate);
}

/** Mono-Mischung (Mittelwert der Kanäle), wie Beat This! sie erwartet. */
export function toMono(pcm: Pcm): Float32Array {
  if (pcm.channels.length === 1) return pcm.channels[0].slice();
  const n = pcm.channels[0].length;
  const out = new Float32Array(n);
  const k = 1 / pcm.channels.length;
  for (const c of pcm.channels) for (let i = 0; i < n; i++) out[i] += c[i] * k;
  return out;
}

/** Stereo erzwingen (Mono wird verdoppelt, mehr als zwei Kanäle: die ersten beiden). */
export function toStereo(pcm: Pcm): Pcm {
  if (pcm.channels.length === 2) return pcm;
  if (pcm.channels.length === 1) return { sampleRate: pcm.sampleRate, channels: [pcm.channels[0], pcm.channels[0]] };
  return { sampleRate: pcm.sampleRate, channels: pcm.channels.slice(0, 2) };
}
