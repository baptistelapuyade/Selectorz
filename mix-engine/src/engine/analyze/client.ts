// Haupt-Thread-Seite des Analyse-Workers.
import type { ExecutionProvider, ModelSize, TrackAnalysis } from '../types';
import type { AnalyzeRequest, AnalyzeResponse } from './analyze.worker';

export class Analyzer {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (a: TrackAnalysis) => void; reject: (e: Error) => void; onProgress?: (stage: string, done: number, total: number) => void }
  >();

  constructor() {
    this.worker = new Worker(new URL('./analyze.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<AnalyzeResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.requestId);
      if (!p) return;
      if (msg.type === 'progress') p.onProgress?.(msg.stage, msg.done, msg.total);
      else {
        this.pending.delete(msg.requestId);
        if (msg.type === 'result') p.resolve(msg.analysis);
        else p.reject(new Error(msg.message));
      }
    };
  }

  /** Übergibt das PCM (wird transferiert, danach im Haupt-Thread leer). */
  analyze(
    args: { id: string; title: string; pcm: Float32Array; decodeMs: number; model: ModelSize; ep: ExecutionProvider | 'auto' },
    onProgress?: (stage: string, done: number, total: number) => void,
  ): Promise<TrackAnalysis> {
    const requestId = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress });
      const msg: AnalyzeRequest = { type: 'analyze', requestId, ...args };
      this.worker.postMessage(msg, [args.pcm.buffer]);
    });
  }

  dispose() {
    this.worker.terminate();
  }
}
