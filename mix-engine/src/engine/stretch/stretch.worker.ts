/// <reference lib="webworker" />
import { stretchChannels } from './stretchCore';

export type StretchRequest = { requestId: number; channels: Float32Array[]; sampleRate: number; factor: number };
export type StretchResponse =
  | { type: 'progress'; requestId: number; fraction: number }
  | { type: 'result'; requestId: number; channels: Float32Array[]; ms: number }
  | { type: 'error'; requestId: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (e: MessageEvent<StretchRequest>) => {
  const { requestId, channels, sampleRate, factor } = e.data;
  try {
    const t = performance.now();
    const out = await stretchChannels(channels, sampleRate, factor, (fraction) =>
      scope.postMessage({ type: 'progress', requestId, fraction } satisfies StretchResponse),
    );
    const msg: StretchResponse = { type: 'result', requestId, channels: out, ms: performance.now() - t };
    scope.postMessage(msg, out.map((c) => c.buffer as ArrayBuffer));
  } catch (err) {
    scope.postMessage({ type: 'error', requestId, message: err instanceof Error ? err.message : String(err) } satisfies StretchResponse);
  }
};
