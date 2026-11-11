// MP3-Schreiber (CBR, Standard 320 kbps), abschnittsweise befüllbar. Kodiert im Worker,
// während der nächste Abschnitt schon gerendert wird.
import type { Mp3Request, Mp3Response } from './mp3.worker';
import { PeakMeter, type AudioSink } from './sink';

export class Mp3Writer implements AudioSink {
  readonly mimeType = 'audio/mpeg';
  readonly extension = 'mp3';
  private worker: Worker;
  private parts: Uint8Array[] = [];
  private seq = 0;
  private done: Promise<void>;
  private resolveDone!: () => void;
  private failed: Error | null = null;
  private ready: Promise<void>;
  private meter = new PeakMeter();
  encodeMs = 0;
  private t0 = 0;

  constructor(readonly sampleRate: number, readonly channels: 1 | 2, readonly bitrate: 320 | 256 | 192 | 128 = 320) {
    this.worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
    this.done = new Promise((r) => (this.resolveDone = r));
    let readyResolve!: () => void;
    let readyReject!: (e: Error) => void;
    this.ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
    this.worker.onmessage = (e: MessageEvent<Mp3Response>) => {
      const m = e.data;
      if (m.type === 'ready') readyResolve();
      else if (m.type === 'data') this.parts[m.seq] = m.bytes;
      else if (m.type === 'done') { this.parts.push(m.bytes); this.encodeMs = performance.now() - this.t0; this.resolveDone(); }
      else if (m.type === 'error') { this.failed = new Error(`MP3-Kodierung fehlgeschlagen: ${m.message}`); readyReject(this.failed); this.resolveDone(); }
    };
    this.worker.onerror = (e) => {
      this.failed = new Error(`MP3-Worker ließ sich nicht starten: ${e.message || 'unbekannter Fehler'}`);
      readyReject(this.failed);
      this.resolveDone();
    };
    this.t0 = performance.now();
    this.post({ type: 'start', sampleRate, channels, bitrate });
  }

  private post(msg: Mp3Request, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer);
  }

  get peak() { return this.meter.peak; }
  get clipped() { return this.meter.clipped; }

  async push(chunk: Float32Array[]): Promise<void> {
    await this.ready;
    // Kopien: die Abschnittsdaten gehören dem OfflineAudioContext
    const channels = chunk.slice(0, this.channels).map((c) => {
      const copy = c.slice();
      this.meter.measure(copy, true);
      return copy;
    });
    this.post({ type: 'chunk', seq: this.seq++, channels }, channels.map((c) => c.buffer as ArrayBuffer));
  }

  async finish(): Promise<Blob> {
    await this.ready;
    this.post({ type: 'finish' });
    await this.done;
    this.worker.terminate();
    if (this.failed) throw this.failed;
    return new Blob(this.parts as BlobPart[], { type: this.mimeType });
  }
}
