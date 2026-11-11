// Analyse-Cache im Browser (IndexedDB). Bleibt lokal; enthält nur Analyse-Ergebnisse
// (Beats, Raster, Energie pro Takt), kein Audio.
import { ENGINE_VERSION, type ModelSize, type TrackAnalysis } from './types';

const DB_NAME = 'selectorz-mix-engine';
const STORE = 'analyses';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** Schlüssel aus Dateimerkmalen, Modell und Engine-Version (neue Version = neu analysieren). */
export function analysisKey(file: { name: string; size: number; lastModified: number }, model: ModelSize): string {
  return [ENGINE_VERSION, model, file.name, file.size, file.lastModified].join('|');
}

export async function getCachedAnalysis(key: string): Promise<TrackAnalysis | undefined> {
  try {
    return await tx<TrackAnalysis | undefined>('readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function putCachedAnalysis(key: string, a: TrackAnalysis): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(a, key));
  } catch {
    /* Cache ist optional */
  }
}

export async function clearAnalysisCache(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}
