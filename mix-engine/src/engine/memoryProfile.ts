// Speicher-Profil: wie viel parallel gestreckt wird und wie viel Rand um den genutzten
// Bereich eines Tracks im Speicher bleibt. Grundlage: Doc „Automix Speicher und
// Rechenleistung v0.1“ (Hebel L2 und L4). Werte sind Startwerte und werden in Phase E
// auf dem Referenz-Laptop nachgemessen.

export interface MemoryProfile {
  /** Anzahl Stretch-Worker. Jeder Worker hält während der Arbeit Eingang und Ausgang eines Tracks. */
  stretchWorkers: number;
  /** Rand in Takten links und rechts des im Mix genutzten Bereichs (Editor ohne neues Strecken). */
  marginBars: number;
  /** Leichter Modus für Geräte mit wenig Arbeitsspeicher. */
  light: boolean;
}

export interface DeviceHints {
  /** navigator.deviceMemory in GB (Chrome/Edge; Safari/Firefox liefern nichts). */
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
}

export function readDeviceHints(): DeviceHints {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & { deviceMemory?: number };
  return { deviceMemoryGb: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency };
}

/**
 * Früher: bis zu 3 Worker parallel und 32 Takte Rand. Das ergab im Spike Spitzen von
 * 2,3–2,5 GB für den ganzen Browser. Jetzt:
 * - höchstens 2 Worker, bei wenig Speicher oder unbekanntem Wert 1 (Safari meldet nichts)
 * - 16 Takte Rand (reicht für Verschieben um zwei Phrasen), im leichten Modus 8
 */
export function memoryProfile(h: DeviceHints = readDeviceHints()): MemoryProfile {
  const mem = h.deviceMemoryGb;
  const cores = h.hardwareConcurrency ?? 2;
  const light = mem !== undefined && mem <= 4;
  const roomy = mem !== undefined && mem >= 8 && cores >= 4;
  return {
    stretchWorkers: roomy ? 2 : 1,
    marginBars: light ? 8 : 16,
    light,
  };
}
