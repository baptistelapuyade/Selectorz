// WAV-Schreiber (PCM 16 Bit, interleaved), abschnittsweise befüllbar.
import type { AudioSink } from './sink';

export class WavWriter implements AudioSink {
  readonly mimeType = 'audio/wav';
  readonly extension = 'wav';
  readonly parts: BlobPart[] = [];
  private written = 0;
  peak = 0;
  clipped = 0;

  constructor(readonly sampleRate: number, readonly channels: number, readonly totalFrames: number) {
    this.parts.push(wavHeader(sampleRate, channels, totalFrames));
  }

  /** Hängt einen Abschnitt an (kanalweise Float32, gleiche Länge). */
  push(chunk: Float32Array[]): void {
    const frames = Math.min(chunk[0].length, this.totalFrames - this.written);
    if (frames <= 0) return;
    const out = new Int16Array(frames * this.channels);
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < this.channels; c++) {
        let s = chunk[Math.min(c, chunk.length - 1)][i];
        const a = Math.abs(s);
        if (a > this.peak) this.peak = a;
        if (a > 1) { this.clipped++; s = s > 0 ? 1 : -1; }
        out[i * this.channels + c] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      }
    }
    this.parts.push(out.buffer);
    this.written += frames;
  }

  get framesWritten() {
    return this.written;
  }

  finish(): Blob {
    if (this.written < this.totalFrames) this.push(Array.from({ length: this.channels }, () => new Float32Array(this.totalFrames - this.written)));
    return new Blob(this.parts, { type: 'audio/wav' });
  }
}

export function wavHeader(sampleRate: number, channels: number, frames: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataBytes = frames * channels * bytesPerSample;
  const buf = new ArrayBuffer(44);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * bytesPerSample, true);
  v.setUint16(32, channels * bytesPerSample, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  return buf;
}
