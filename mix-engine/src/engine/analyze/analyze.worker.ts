/// <reference lib="webworker" />
// Analyse-Worker: hält die ONNX-Sitzungen und analysiert einen Track nach dem anderen.
import type { ExecutionProvider, ModelSize, TrackAnalysis } from '../types';
import { analyzeTrack } from './analyze';
import { loadModel, type LoadedModel } from './beatthis';

export type AnalyzeRequest = {
  type: 'analyze';
  requestId: number;
  id: string;
  title: string;
  pcm: Float32Array;
  decodeMs: number;
  model: ModelSize;
  ep: ExecutionProvider | 'auto';
};

export type AnalyzeResponse =
  | { type: 'progress'; requestId: number; stage: string; done: number; total: number }
  | { type: 'result'; requestId: number; analysis: TrackAnalysis }
  | { type: 'error'; requestId: number; message: string };

const models = new Map<string, Promise<LoadedModel>>();

function getModel(size: ModelSize, ep: ExecutionProvider | 'auto') {
  const key = `${size}:${ep}`;
  let m = models.get(key);
  if (!m) {
    m = loadModel(size, ep);
    models.set(key, m);
    m.catch(() => models.delete(key));
  }
  return m;
}

const post = (msg: AnalyzeResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const req = e.data;
  if (req.type !== 'analyze') return;
  try {
    const fresh = !models.has(`${req.model}:${req.ep}`);
    const tLoad = performance.now();
    const model = await getModel(req.model, req.ep);
    const loadMs = fresh ? performance.now() - tLoad : 0;
    const analysis = await analyzeTrack(
      { id: req.id, title: req.title, pcm: req.pcm, decodeMs: req.decodeMs },
      model,
      (stage, done, total) => post({ type: 'progress', requestId: req.requestId, stage, done, total }),
    );
    analysis.timings.modelLoadMs = loadMs;
    post({ type: 'result', requestId: req.requestId, analysis });
  } catch (err) {
    post({ type: 'error', requestId: req.requestId, message: err instanceof Error ? err.message : String(err) });
  }
};
