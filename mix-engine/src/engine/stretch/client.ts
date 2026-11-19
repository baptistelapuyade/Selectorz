// Kleiner Pool von Stretch-Workern. Größe kommt aus dem Speicher-Profil (memory.ts):
// standardmäßig 1, auf großzügigen Geräten 2. Mehr Parallelität spart kaum Zeit, verdoppelt
// aber den Spitzenbedarf beim Laden.
import { memoryProfile } from '../memoryProfile';
import type { StretchRequest, StretchResponse } from './stretch.worker';

interface Job {
  req: StretchRequest;
  resolve: (r: { channels: Float32Array[]; ms: number }) => void;
  reject: (e: Error) => void;
  onProgress?: (f: number) => void;
}

export class StretchPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<number, Job>();
  private nextId = 1;

  constructor(size = memoryProfile().stretchWorkers) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./stretch.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<StretchResponse>) => this.onMessage(w, e.data);
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  get size() {
    return this.workers.length;
  }

  /** Kanäle werden in den Worker transferiert (danach hier leer). */
  stretch(channels: Float32Array[], sampleRate: number, factor: number, onProgress?: (f: number) => void) {
    return new Promise<{ channels: Float32Array[]; ms: number }>((resolve, reject) => {
      this.queue.push({ req: { requestId: this.nextId++, channels, sampleRate, factor }, resolve, reject, onProgress });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.running.set(job.req.requestId, job);
      w.postMessage(job.req, job.req.channels.map((c) => c.buffer as ArrayBuffer));
    }
  }

  private onMessage(w: Worker, msg: StretchResponse) {
    const job = this.running.get(msg.requestId);
    if (!job) return;
    if (msg.type === 'progress') {
      job.onProgress?.(msg.fraction);
      return;
    }
    this.running.delete(msg.requestId);
    this.idle.push(w);
    if (msg.type === 'result') job.resolve({ channels: msg.channels, ms: msg.ms });
    else job.reject(new Error(msg.message));
    this.pump();
  }

  dispose() {
    this.workers.forEach((w) => w.terminate());
  }
}
