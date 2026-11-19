import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Signalsmith Stretch wird als npm-Paket nur als AudioWorklet-Wrapper ausgeliefert.
 * Für das Offline-Stretching im Worker brauchen wir die darin eingebettete
 * Emscripten-Fabrik (WASM als Base64). Dieses Plugin schneidet sie zur Build-Zeit
 * aus dem unveränderten Paket heraus (kein vendored Code im Repo).
 */
function signalsmithCore(): Plugin {
  const id = 'virtual:signalsmith-stretch-core';
  const resolved = '\0' + id;
  return {
    name: 'signalsmith-stretch-core',
    resolveId(source) {
      return source === id ? resolved : null;
    },
    load(loadId) {
      if (loadId !== resolved) return null;
      const require = createRequire(import.meta.url);
      const file = require.resolve('signalsmith-stretch').replace(/\.js$/, '.mjs');
      const src = readFileSync(file, 'utf8');
      const cut = src.indexOf('function registerWorkletProcessor');
      if (cut < 0) throw new Error('signalsmith-stretch: Struktur unerwartet, Fabrik nicht gefunden');
      return `${src.slice(0, cut)}\nexport default SignalsmithStretch;\n`;
    },
  };
}

export default defineConfig({
  plugins: [signalsmithCore()],
  server: {
    // Cross-Origin-Isolation: SharedArrayBuffer für mehrthreadiges ONNX-WASM
    // und performance.measureUserAgentSpecificMemory().
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
    // vorab bündeln, sonst lädt der Dev-Server die Seite beim ersten MP3-Export neu
    include: ['wasm-media-encoders'],
  },
  worker: {
    format: 'es',
    plugins: () => [signalsmithCore()],
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
