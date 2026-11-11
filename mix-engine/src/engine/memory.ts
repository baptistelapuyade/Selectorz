// Speicher messen, soweit der Browser es zulässt.

export interface MemoryReading {
  /** Gesamtspeicher der Seite laut Browser (nur Chrome, nur mit Cross-Origin-Isolation). */
  uaBytes?: number;
  /** JS-Heap (nur Chrome, ohne die meisten Audio-Puffer). */
  jsHeapBytes?: number;
  source: string;
}

export async function measureMemory(): Promise<MemoryReading> {
  const perf = performance as Performance & {
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
    memory?: { usedJSHeapSize: number };
  };
  const r: MemoryReading = { source: '' };
  if (perf.memory) r.jsHeapBytes = perf.memory.usedJSHeapSize;
  if (globalThis.crossOriginIsolated && perf.measureUserAgentSpecificMemory) {
    try {
      // kann bis zu ~20 s dauern (der Browser misst beim nächsten GC)
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000));
      r.uaBytes = (await Promise.race([perf.measureUserAgentSpecificMemory(), timeout])).bytes;
    } catch {
      /* nicht verfügbar */
    }
  }
  r.source = r.uaBytes !== undefined ? 'measureUserAgentSpecificMemory' : r.jsHeapBytes !== undefined ? 'performance.memory (nur JS-Heap)' : 'nicht messbar';
  return r;
}

export const mb = (bytes: number | undefined) => (bytes === undefined ? '–' : `${(bytes / 1048576).toFixed(0)} MB`);
