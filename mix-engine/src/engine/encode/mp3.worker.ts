/// <reference lib="webworker" />
// MP3-Kodierung im Worker. LAME 3.100 (LGPL) läuft als eigene, unveränderte WASM-Datei
// (wasm-media-encoders), die zur Laufzeit geladen wird und austauschbar bleibt.
import { createEncoder } from 'wasm-media-encoders';
import mp3WasmUrl from 'wasm-media-encoders/wasm/mp3?url';

export type Mp3Request =
  | { type: 'start'; sampleRate: number; channels: 1 | 2; bitrate: 320 | 256 | 192 | 128 }
  | { type: 'chunk'; seq: number; channels: Float32Array[] }
  | { type: 'finish' };

export type Mp3Response =
  | { type: 'ready' }
  | { type: 'data'; seq: number; bytes: Uint8Array }
  | { type: 'done'; bytes: Uint8Array }
  | { type: 'error'; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let encoder: Awaited<ReturnType<typeof createEncoder<'audio/mpeg'>>> | null = null;
let queue: Promise<void> = Promise.resolve();

function send(msg: Mp3Response) {
  if (msg.type === 'data' || msg.type === 'done') scope.postMessage(msg, [msg.bytes.buffer as ArrayBuffer]);
  else scope.postMessage(msg);
}

scope.onmessage = (e: MessageEvent<Mp3Request>) => {
  const msg = e.data;
  // Nachrichten strikt nacheinander abarbeiten (start ist asynchron)
  queue = queue.then(async () => {
    try {
      if (msg.type === 'start') {
        encoder = await createEncoder('audio/mpeg', mp3WasmUrl);
        encoder.configure({ sampleRate: msg.sampleRate, channels: msg.channels, bitrate: msg.bitrate });
        send({ type: 'ready' });
      } else if (msg.type === 'chunk') {
        if (!encoder) throw new Error('MP3-Encoder nicht gestartet');
        // Ausgabe gehört dem Encoder und muss kopiert werden
        send({ type: 'data', seq: msg.seq, bytes: encoder.encode(msg.channels).slice() });
      } else if (msg.type === 'finish') {
        if (!encoder) throw new Error('MP3-Encoder nicht gestartet');
        send({ type: 'done', bytes: encoder.finalize().slice() });
        encoder = null;
      }
    } catch (err) {
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  });
};
