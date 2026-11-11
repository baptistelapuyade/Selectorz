// Öffentliche Schnittstelle der Mix-Engine (UI-unabhängig).
export * from './types';
export { decodeFile, toMono, toStereo, SUPPORTED, DecodeError } from './decode/decode';
export { parseAiff, isAiff } from './decode/aiff';
export { Analyzer } from './analyze/client';
export { compareAnalyses } from './analyze/analyze';
export { SAMPLE_RATE as ANALYSIS_SAMPLE_RATE } from './analyze/features';
export { plan, masterTempo, phraseStarts, DEFAULT_PLAN_OPTIONS, type PlanOptions, type PlanTrack } from './plan/plan';
export { resolveTimeline, evalEnvelope, mixTimeOfBar } from './plan/timeline';
export { StretchPool } from './stretch/client';
export { prepareStretched, MIX_SAMPLE_RATE, type PrepareStats } from './media';
export { buildMixGraph, MASTER, type StretchedTrack } from './graph/mixGraph';
export { LivePlayer } from './graph/live';
export { renderMix, renderToArrays, sectionEquality, diffStats, type DiffStats } from './render/render';
export { WavWriter } from './encode/wav';
export { measureMemory, mb } from './memory';
