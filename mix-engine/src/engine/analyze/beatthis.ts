// Beat-This!-Inferenz mit ONNX Runtime Web (WebGPU, Fallback WASM).
// Fensterung wie upstream: 1500 Frames (30 s), 6 Frames Rand, „keep_first“.
import * as ort from 'onnxruntime-web/webgpu';
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import type { ExecutionProvider, ModelSize } from '../types';
import { N_MELS } from './features';

const CHUNK = 1500;
const BORDER = 6;

let envReady = false;
function setupEnv() {
  if (envReady) return;
  ort.env.wasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl };
  const cores = (globalThis.navigator?.hardwareConcurrency ?? 4) | 0;
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.max(1, Math.min(4, cores - 1)) : 1;
  ort.env.logLevel = 'error';
  envReady = true;
}

export interface LoadedModel {
  size: ModelSize;
  ep: ExecutionProvider;
  session: ort.InferenceSession;
  inputName: string;
  beatName: string;
  downbeatName: string;
  loadMs: number;
}

export const MODEL_URLS: Record<ModelSize, string> = {
  small: '/models/beat-this-small0.onnx',
  large: '/models/beat-this-final0.onnx',
};

async function hasWebGpu(): Promise<boolean> {
  const gpu = (globalThis.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })?.gpu;
  if (!gpu) return false;
  try {
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

export async function loadModel(size: ModelSize, prefer: ExecutionProvider | 'auto', baseUrl = ''): Promise<LoadedModel> {
  setupEnv();
  const t = performance.now();
  const res = await fetch(baseUrl + MODEL_URLS[size]);
  if (!res.ok) throw new Error(`Modell „${size}“ nicht gefunden (${MODEL_URLS[size]}). Bitte „npm run models“ ausführen.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const order: ExecutionProvider[] = prefer === 'wasm' ? ['wasm'] : (await hasWebGpu()) ? ['webgpu', 'wasm'] : ['wasm'];
  let lastErr: unknown;
  for (const ep of order) {
    try {
      const session = await ort.InferenceSession.create(bytes, { executionProviders: [ep], graphOptimizationLevel: 'all' });
      const inputName = session.inputNames[0];
      const downbeatName = session.outputNames.find((n) => /down/i.test(n)) ?? session.outputNames[1];
      const beatName = session.outputNames.find((n) => n !== downbeatName) ?? session.outputNames[0];
      return { size, ep, session, inputName, beatName, downbeatName, loadMs: performance.now() - t };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Modell „${size}“ ließ sich nicht starten: ${String(lastErr)}`);
}

/** Frame-weise Logits für das ganze Stück (Länge = frames). */
export async function inferLogits(
  model: LoadedModel,
  mel: Float32Array,
  frames: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ beat: Float32Array; downbeat: Float32Array }> {
  const starts: number[] = [];
  for (let s = -BORDER; s < frames - BORDER; s += CHUNK - 2 * BORDER) starts.push(s);
  if (frames > CHUNK - 2 * BORDER) starts[starts.length - 1] = frames - (CHUNK - BORDER);

  const beat = new Float32Array(frames).fill(-1000);
  const downbeat = new Float32Array(frames).fill(-1000);
  const preds: Array<{ start: number; beat: Float32Array; downbeat: Float32Array }> = [];

  for (let c = 0; c < starts.length; c++) {
    const start = starts[c];
    const from = Math.max(start, 0);
    const to = Math.min(start + CHUNK, frames);
    const left = Math.max(0, -start);
    const right = Math.max(0, Math.min(BORDER, start + CHUNK - frames));
    const len = left + (to - from) + right;
    const input = new Float32Array(len * N_MELS);
    input.set(mel.subarray(from * N_MELS, to * N_MELS), left * N_MELS);
    const feeds = { [model.inputName]: new ort.Tensor('float32', input, [1, len, N_MELS]) };
    const out = await model.session.run(feeds);
    const b = (await out[model.beatName].getData()) as Float32Array;
    const d = (await out[model.downbeatName].getData()) as Float32Array;
    for (const t of Object.values(out)) t.dispose?.();
    preds.push({ start, beat: b.slice(BORDER, len - BORDER), downbeat: d.slice(BORDER, len - BORDER) });
    onProgress?.(c + 1, starts.length);
  }
  // keep_first: spätere Fenster zuerst schreiben, frühere überschreiben
  for (let c = preds.length - 1; c >= 0; c--) {
    const p = preds[c];
    const dst = p.start + BORDER;
    for (let i = 0; i < p.beat.length; i++) {
      const j = dst + i;
      if (j < 0 || j >= frames || j >= p.start + CHUNK - BORDER) continue;
      beat[j] = p.beat[i];
      downbeat[j] = p.downbeat[i];
    }
  }
  return { beat, downbeat };
}
