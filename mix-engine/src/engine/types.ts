// Gemeinsame Typen der Mix-Engine. UI-unabhängig.

export const ENGINE_VERSION = 'selectorz-mix-engine@0.1.0-spike';

/** PCM, kanalweise (nicht interleaved). */
export interface Pcm {
  sampleRate: number;
  channels: Float32Array[];
}

export type ModelSize = 'small' | 'large';
export type ExecutionProvider = 'webgpu' | 'wasm';

/** Konstantes Beat-Raster (House/Techno, 4/4). Zeiten in Sekunden im Original-Track. */
export interface BeatGrid {
  /** Zeit des ersten vollständigen Takts (Downbeat, Takt 0). */
  t0: number;
  /** Beat-Abstand in Sekunden. */
  period: number;
  beatsPerBar: 4;
  /** Anzahl vollständiger Takte ab t0. */
  barCount: number;
  /** Mittlere Abweichung der erkannten Beats vom Raster (ms). Hoch = Tempo schwankt. */
  residualMs: number;
  /** Anteil der Beats, die zum Raster passen (|Abweichung| < 35 ms). */
  inlierShare: number;
  /** Anteil der erkannten Downbeats, die zur gewählten Takt-Phase passen. */
  downbeatConfidence: number;
  /** Feinjustierung der Phase an den Kick-Einsätzen (ms, positiv = später). */
  phaseShiftMs: number;
}

/** Energie eines Takts in drei Bändern (dB, relativ). */
export interface BarEnergy {
  low: number; // ca. 30–150 Hz (Kick, Bass)
  mid: number; // ca. 150–2500 Hz
  high: number; // ca. 2.5–11 kHz (Hats, Luft)
}

export interface TrackAnalysis {
  id: string;
  title: string;
  /** Dauer des Originals in Sekunden. */
  duration: number;
  model: ModelSize;
  executionProvider: ExecutionProvider;
  /** Rohe Erkennung (Sekunden). */
  beats: number[];
  downbeats: number[];
  /** BPM aus dem Raster (Regression), auf 0,01 genau. */
  bpm: number;
  /** BPM als Median der Beat-Abstände (zum Vergleich, wie im Plan 3.3). */
  bpmMedian: number;
  grid: BeatGrid;
  /** Phrasenlänge in Takten (v1: 8) und Versatz des Phrasenrasters. */
  phraseBars: number;
  phraseOffset: number;
  bars: BarEnergy[];
  /** Erster Takt nach dem Intro (Phrasengrenze). */
  introEndBar: number;
  /** Erster Takt des Outros (Phrasengrenze). */
  outroStartBar: number;
  introSource: 'energy' | 'bass' | 'default';
  outroSource: 'energy' | 'bass' | 'default';
  /** Integrierte Lautheit (BS.1770-Näherung, Mono, LUFS). */
  loudness: number;
  timings: AnalysisTimings;
  /** true, wenn das Ergebnis aus dem lokalen Analyse-Cache stammt (Zeiten sind dann die des ersten Laufs). */
  fromCache?: boolean;
}

export interface AnalysisTimings {
  decodeMs: number;
  featuresMs: number;
  inferenceMs: number;
  postMs: number;
  totalMs: number;
  modelLoadMs: number;
}

// ───────────────────────── Rezept (das, was der Server später speichert) ─────────────────────────

export type MasterTempoMode = 'first' | 'median' | 'minimax';
/** blend: lange Blende mit Bass swap · quick: je ein Takt Ein-/Ausblenden um den Swap · cut: harter Wechsel auf der Eins. */
export type TransitionStyle = 'blend' | 'quick' | 'cut';

export interface RecipeTrack {
  id: string;
  title: string;
  /** Erkanntes Original-Tempo. */
  bpm: number;
  /** Lautheitsangleichung in dB. */
  gainDb: number;
  /** Korrektur des Rasters („Set the one here“): Verschiebung in Takten/Beats. v1: nur Beat-Versatz. */
  gridShiftBeats: number;
}

export interface RecipeTransition {
  /** Index des abgehenden Tracks in `tracks`; der kommende ist from + 1. */
  from: number;
  /** Takt im abgehenden Track, an dem der kommende einsetzt. */
  outBar: number;
  /** Takt im kommenden Track, der auf outBar liegt. */
  inBar: number;
  /** Länge des Übergangs in Takten (8, 16, 32, 64). */
  bars: number;
  /** Bass swap nach so vielen Takten ab Übergangsbeginn (Standard: Mitte). */
  bassSwapBar: number;
  /** Bass swap über das Low-Shelf (bei „cut“ ohne Wirkung). */
  bassSwap: boolean;
  style: TransitionStyle;
  /** true, wenn eine Person den Übergang verändert hat (für später). */
  edited: boolean;
}

export interface MixRecipe {
  engine: string;
  masterTempoMode: MasterTempoMode | 'manual';
  masterBpm: number;
  tracks: RecipeTrack[];
  transitions: RecipeTransition[];
  /** Ziel-Lautheit nach Angleichung (LUFS, vor Limiter). */
  targetLoudness: number;
  warnings: string[];
}

// ───────────────────────── Aufgelöste Zeitleiste (abgeleitet, nicht gespeichert) ─────────────────────────

/** Stückweise linearer Verlauf über die Mix-Zeit (Sekunden). */
export type Envelope = Array<[time: number, value: number]>;

export interface TimelineTrack {
  index: number;
  id: string;
  /** Zeitdehnung: Ausgabedauer / Eingabedauer = bpm / masterBpm. */
  stretch: number;
  /** Benutzter Bereich im Original (Sekunden). */
  sourceStart: number;
  sourceEnd: number;
  /** Start dieses Bereichs in der Mix-Zeit (Sekunden). */
  mixStart: number;
  mixEnd: number;
  gainDb: number;
  /** Lautstärke-Fader (linear, 0..1). */
  fader: Envelope;
  /** Low-Shelf-Gain für Bass swap (dB, 0 = voll, -40 = weg). */
  lowShelfDb: Envelope;
}

export interface TimelineTransition {
  index: number;
  from: number;
  to: number;
  outBar: number;
  inBar: number;
  bars: number;
  style: TransitionStyle;
  bassSwapOn: boolean;
  start: number;
  /** Zeitpunkt des Wechsels (Bass swap bzw. Schnitt). */
  bassSwap: number;
  end: number;
}

export interface Timeline {
  masterBpm: number;
  barSeconds: number;
  duration: number;
  tracks: TimelineTrack[];
  transitions: TimelineTransition[];
}
