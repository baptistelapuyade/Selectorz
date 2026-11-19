// Gemeinsame Schnittstelle der Export-Formate.

export interface AudioSink {
  readonly mimeType: string;
  readonly extension: string;
  readonly peak: number;
  readonly clipped: number;
  push(chunk: Float32Array[]): void | Promise<void>;
  finish(): Blob | Promise<Blob>;
}

/** Spitzenpegel und Übersteuerung messen; optional auf ±1 begrenzen. */
export class PeakMeter {
  peak = 0;
  clipped = 0;
  measure(x: Float32Array, clamp = false) {
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > this.peak) this.peak = a;
      if (a > 1) {
        this.clipped++;
        if (clamp) x[i] = x[i] > 0 ? 1 : -1;
      }
    }
  }
}
