// Schlichte Testseite für den Spike. Kein Design; nur Bedienung und Messwerte.
// Die Engine (src/engine) kennt diese Seite nicht.
import {
  ANALYSIS_SAMPLE_RATE,
  Analyzer,
  compareAnalyses,
  decodeFile,
  diffStats,
  ENGINE_VERSION,
  LivePlayer,
  mb,
  measureMemory,
  MIX_SAMPLE_RATE,
  mixTimeOfBar,
  plan,
  prepareStretched,
  renderMix,
  renderToArrays,
  resolveTimeline,
  sectionEquality,
  StretchPool,
  toMono,
  WavWriter,
  Mp3Writer,
  type AudioSink,
  type DiffStats,
  type ExecutionProvider,
  type MasterTempoMode,
  type MixRecipe,
  type ModelSize,
  type PlanOptions,
  type PrepareStats,
  type StretchedTrack,
  type Timeline,
  type TrackAnalysis,
  type TransitionStyle,
  type EditResult,
  editTransition,
  shiftGrid,
  ALLOWED_BARS,
  analysisKey,
  getCachedAnalysis,
  putCachedAnalysis,
  clearAnalysisCache,
} from '../engine';

// ───────────── Helfer ─────────────
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmtTime = (s: number) => {
  if (!Number.isFinite(s)) return '–';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
};
const ms = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? '–' : `${Math.round(x)} ms`);
const n2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '–');
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)} %` : '–');
const dbStr = (x: number) => (x === -Infinity ? '−∞ dB' : Number.isFinite(x) ? `${x.toFixed(1)} dB` : '–');

function table(el: HTMLTableElement, head: string[], rows: Array<Array<string | number | HTMLElement>>) {
  el.innerHTML = '';
  if (!rows.length) return;
  const thead = el.createTHead().insertRow();
  head.forEach((h) => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
  const body = el.createTBody();
  for (const r of rows) {
    const tr = body.insertRow();
    for (const c of r) {
      const td = tr.insertCell();
      if (c instanceof HTMLElement) td.appendChild(c);
      else { td.textContent = String(c); if (typeof c === 'number' || /^[−\-+]?[\d.,]+( ?(ms|s|%|dB|MB|LUFS|BPM))?$/.test(String(c))) td.className = 'num'; }
    }
  }
}

function button(label: string, onClick: () => void, disabled = false) {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = disabled;
  b.onclick = onClick;
  return b;
}

const status = (s: string) => ($('status').textContent = s);
const error = (s: string) => { $('errors').textContent += s + '\n'; console.error(s); };

// ───────────── Zustand ─────────────
interface Item { id: string; title: string; file: File }
let items: Item[] = [];
let analyses: TrackAnalysis[] = [];
const others = new Map<string, TrackAnalysis>();
let recipe: MixRecipe | null = null;
let timeline: Timeline | null = null;
let media = new Map<string, StretchedTrack>();
let prepStats: PrepareStats[] = [];
let busy = false;
let idCounter = 0;

const metrics: {
  analysisWallMs?: number;
  prepareWallMs?: number;
  stretchWorkers?: number;
  totalWallMs?: number;
  render?: { format: string; ms: number; totalMs: number; sections: number; realtimeFactor: number; peak: number; clippedSamples: number; peakSectionMB: number; fileMB: number };
  memory?: { audioBuffersMB: number; browserMB?: number; jsHeapMB?: number; source: string; at: string }[];
  equality?: { sections?: DiffStats; live?: DiffStats };
} = {};

let analyzer: Analyzer | null = null;
let pool: StretchPool | null = null;
let player: LivePlayer | null = null;

// ───────────── Umgebung ─────────────
async function showEnv() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  let webgpu = 'nein';
  if (gpu) { try { webgpu = (await gpu.requestAdapter()) ? 'ja' : 'kein Adapter'; } catch { webgpu = 'Fehler'; } }
  let models = 'unbekannt';
  try {
    const r = await fetch('/models/models.json');
    if (r.ok) { const j = await r.json(); models = Object.keys(j).map((k) => `${k} (${j[k].file})`).join(', ') || 'keine'; }
    else models = 'keine – bitte „npm run models“ ausführen';
  } catch { models = 'keine'; }
  $('env').textContent = `Engine ${ENGINE_VERSION} · cross-origin-isolated: ${globalThis.crossOriginIsolated ? 'ja' : 'nein'} · WebGPU: ${webgpu} · Kerne: ${navigator.hardwareConcurrency} · Modelle: ${models}`;
}

// ───────────── Dateien ─────────────
function addFiles(list: FileList | File[]) {
  const added = [...list]
    .filter((f) => /\.(mp3|wav|aiff?|flac|m4a|aac|ogg)$/i.test(f.name) || f.type.startsWith('audio/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((file) => ({ id: `t${++idCounter}`, title: file.name.replace(/\.[^.]+$/, ''), file }));
  items.push(...added);
  renderFiles();
}

function renderFiles() {
  table(
    $('fileTable'),
    ['#', 'Datei', 'Größe', ''],
    items.map((it, i) => {
      const span = document.createElement('span');
      span.append(
        button('↑', () => { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; renderFiles(); } }, busy || i === 0),
        button('↓', () => { if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; renderFiles(); } }, busy || i === items.length - 1),
        button('✕', () => { items.splice(i, 1); renderFiles(); }, busy),
      );
      return [i + 1, it.file.name, `${(it.file.size / 1048576).toFixed(1)} MB`, span];
    }),
  );
}

const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });
$<HTMLInputElement>('files').addEventListener('change', (e) => { const f = (e.target as HTMLInputElement).files; if (f) addFiles(f); (e.target as HTMLInputElement).value = ''; });

// ───────────── Optionen ─────────────
const sel = (id: string) => $<HTMLSelectElement>(id).value;
function planOptions(): Partial<PlanOptions> {
  const bars = sel('bars');
  return { masterTempo: sel('tempo') as MasterTempoMode, transitionBars: bars === 'auto' ? 'auto' : (Number(bars) as 8 | 16 | 32 | 64) };
}

// ───────────── Analyse ─────────────
function renderAnalysis() {
  table(
    $('analysisTable'),
    ['Track', 'Dauer', 'Dekodieren', 'Merkmale', 'Inferenz', 'Analyse gesamt', 'Modell laden', 'Modell/EP', 'BPM (Raster)', 'BPM (Median)', 'Raster-Abw.', 'Feinjustierung', 'passende Beats', 'erster Schlag', 'Takte', 'Phrasen-Versatz', 'Intro bis Takt', 'Outro ab Takt', 'Lautheit'],
    analyses.map((a) => [
      a.title + (a.fromCache ? ' (Cache)' : ''), fmtTime(a.duration), ms(a.timings.decodeMs), ms(a.timings.featuresMs), ms(a.timings.inferenceMs), ms(a.timings.totalMs),
      a.timings.modelLoadMs ? ms(a.timings.modelLoadMs) : '–', `${a.model}/${a.executionProvider}`, n2(a.bpm), n2(a.bpmMedian),
      `${a.grid.residualMs.toFixed(1)} ms`, `${a.grid.phaseShiftMs > 0 ? '+' : ''}${a.grid.phaseShiftMs.toFixed(1)} ms`, pct(a.grid.inlierShare), pct(a.grid.downbeatConfidence), a.grid.barCount, a.phraseOffset,
      `${a.introEndBar} (${a.introSource})`, `${a.outroStartBar} (${a.outroSource})`, `${a.loudness.toFixed(1)} LUFS`,
    ]),
  );
  const cmpRows = analyses.filter((a) => others.has(a.id)).map((a) => {
    const o = others.get(a.id)!;
    const c = compareAnalyses(a, o);
    return [a.title, `${a.model}: ${ms(a.timings.inferenceMs)}`, `${o.model}: ${ms(o.timings.inferenceMs)}`, n2(a.bpm), n2(o.bpm), n2(c.bpmDiff), `${c.t0DiffMs.toFixed(0)} ms`, pct(c.beatF), pct(c.downbeatF)];
  });
  table($('compareTable'), ['Vergleich', 'Inferenz A', 'Inferenz B', 'BPM A', 'BPM B', 'Δ BPM', 'Δ erster Takt', 'Beats gleich (F, ±70 ms)', 'Downbeats gleich (F)'], cmpRows);
}

async function analyzeAll(): Promise<void> {
  analyzer ??= new Analyzer();
  const model = sel('model') as ModelSize;
  const other: ModelSize = model === 'small' ? 'large' : 'small';
  const ep = sel('ep') as ExecutionProvider | 'auto';
  const compare = $<HTMLInputElement>('compare').checked;
  analyses = [];
  others.clear();
  const t = performance.now();
  const useCache = $<HTMLInputElement>('useCache').checked;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const key = analysisKey(it.file, model);
    const keyOther = analysisKey(it.file, other);
    if (useCache) {
      const hit = await getCachedAnalysis(key);
      const hitOther = compare ? await getCachedAnalysis(keyOther) : undefined;
      if (hit && (!compare || hitOther)) {
        analyses.push({ ...hit, id: it.id, title: it.title, fromCache: true });
        if (hitOther) others.set(it.id, { ...hitOther, id: it.id, title: it.title, fromCache: true });
        renderAnalysis();
        continue;
      }
    }
    status(`Analyse ${i + 1}/${items.length}: ${it.title} – dekodieren …`);
    const td = performance.now();
    let mono: Float32Array;
    try {
      mono = toMono(await decodeFile(it.file, ANALYSIS_SAMPLE_RATE));
    } catch (err) {
      error(`„${it.file.name}“: Datei nicht lesbar (${err instanceof Error ? err.message : err}). Unterstützt: MP3, WAV, AIFF, FLAC, M4A.`);
      continue;
    }
    const decodeMs = performance.now() - td;
    const copy = compare ? mono.slice() : null;
    try {
      const a = await analyzer.analyze({ id: it.id, title: it.title, pcm: mono, decodeMs, model, ep }, (stage, d, tot) =>
        status(`Analyse ${i + 1}/${items.length}: ${it.title} – ${stage === 'inference' ? `Beat This! ${d}/${tot}` : 'Merkmale'}`),
      );
      analyses.push(a);
      void putCachedAnalysis(key, a);
      if (copy) {
        status(`Analyse ${i + 1}/${items.length}: ${it.title} – Vergleichsmodell …`);
        const o = await analyzer.analyze({ id: it.id, title: it.title, pcm: copy, decodeMs, model: other, ep });
        others.set(it.id, o);
        void putCachedAnalysis(keyOther, o);
      }
    } catch (err) {
      error(`„${it.title}“: Analyse fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      if (String(err).includes('npm run models')) throw err;
    }
    renderAnalysis();
  }
  metrics.analysisWallMs = performance.now() - t;
  // Modell-Sitzungen (WASM-Speicher von ONNX Runtime) freigeben; bei Bedarf neu laden
  analyzer.dispose();
  analyzer = null;
}

// ───────────── Planen ─────────────
function renderMixInfo() {
  if (!recipe || !timeline) return;
  const tl = timeline;
  const r = recipe;
  $('mixSummary').textContent = `Länge ${fmtTime(tl.duration)} · Master-Tempo ${r.masterBpm.toFixed(2)} BPM (${r.masterTempoMode}) · ${r.transitions.length} Übergänge · Ziel-Lautheit ${r.targetLoudness.toFixed(1)} LUFS`;
  const ul = $('warnings');
  ul.innerHTML = '';
  for (const w of r.warnings) { const li = document.createElement('li'); li.textContent = w; ul.appendChild(li); }
  const title = (i: number) => r.tracks[i].title;
  const disabled = busy || !media.size;
  const shiftRow = (label: string, i: number, key: 'outBarDelta' | 'inBarDelta') => {
    const span = document.createElement('span');
    span.append(label + ' ');
    for (const d of [-8, -1, 1, 8]) span.append(button(`${d > 0 ? '+' : '−'}${Math.abs(d)}`, () => void applyEdit(editTransition(r, analyses, i, { [key]: d })), disabled));
    return span;
  };
  const selectEl = (options: Array<[string, string]>, value: string, onChange: (v: string) => void) => {
    const el = document.createElement('select');
    for (const [v, l] of options) { const o = document.createElement('option'); o.value = v; o.textContent = l; el.appendChild(o); }
    el.value = value;
    el.disabled = disabled;
    el.onchange = () => onChange(el.value);
    return el;
  };
  table(
    $('transitionTable'),
    ['#', 'Track (raus)', 'Out-Takt', 'Track (rein)', 'In-Takt', 'Länge', 'Stil', 'Bass swap', 'Start im Mix', 'Wechsel', 'Ende', 'Verschieben', ''],
    tl.transitions.map((t, i) => {
      const rt = r.transitions[i];
      const bass = document.createElement('input');
      bass.type = 'checkbox';
      bass.checked = rt.bassSwap;
      bass.disabled = disabled || rt.style === 'cut';
      bass.onchange = () => void applyEdit(editTransition(r, analyses, i, { bassSwap: bass.checked }));
      const shifts = document.createElement('div');
      shifts.append(shiftRow('Out', i, 'outBarDelta'), document.createElement('br'), shiftRow('In', i, 'inBarDelta'));
      return [
        i + 1 + (rt.edited ? ' ✎' : ''), title(t.from), t.outBar, title(t.to), t.inBar,
        selectEl(ALLOWED_BARS.map((b) => [String(b), `${b} Takte`]), String(rt.bars), (v) => void applyEdit(editTransition(r, analyses, i, { bars: Number(v) as 8 | 16 | 32 | 64 }))),
        selectEl([['blend', 'Blend'], ['quick', 'Quick'], ['cut', 'Cut']], rt.style, (v) => void applyEdit(editTransition(r, analyses, i, { style: v as TransitionStyle }))),
        bass,
        fmtTime(t.start), fmtTime(t.bassSwap), fmtTime(t.end), shifts,
        button('▶ anhören', () => void playFrom(Math.max(0, t.start - 8)).catch((e) => error(String(e))), !media.size),
      ];
    }),
  );
  table(
    $('trackTable'),
    ['Track', 'BPM', 'Tempo im Mix', 'Gain', 'Bereich im Original', 'Im Mix', 'Tracklist (Takt 0)', 'Eins („Set the one here“)'],
    tl.tracks.map((t, i) => {
      const one = document.createElement('span');
      const sh = r.tracks[i].gridShiftBeats;
      one.append(
        button('−1 Beat', () => void applyEdit(shiftGrid(r, analyses, i, -1)), disabled),
        ` ${sh > 0 ? '+' : ''}${sh} `,
        button('+1 Beat', () => void applyEdit(shiftGrid(r, analyses, i, 1)), disabled),
      );
      return [
        title(i), n2(r.tracks[i].bpm), `${t.stretch > 1 ? '−' : '+'}${Math.abs((1 / t.stretch - 1) * 100).toFixed(2)} %`, `${r.tracks[i].gainDb.toFixed(1)} dB`,
        `${fmtTime(t.sourceStart)} – ${fmtTime(t.sourceEnd)}`, `${fmtTime(t.mixStart)} – ${fmtTime(t.mixEnd)}`,
        fmtTime(i === 0 ? 0 : Math.max(0, mixTimeOfBar(tl, r, analyses, i, r.transitions[i - 1].inBar))),
        one,
      ];
    }),
  );
  $('recipe').textContent = JSON.stringify(r, null, 2);
  $<HTMLButtonElement>('toggleRecipe').disabled = false;
  $<HTMLButtonElement>('copyRecipe').disabled = false;
}

function doPlan() {
  const ordered = items.map((it) => analyses.find((a) => a.id === it.id)).filter((a): a is TrackAnalysis => !!a);
  recipe = plan(ordered, planOptions());
  timeline = resolveTimeline(recipe, ordered);
  renderMixInfo();
}

/** Rezept-Änderung übernehmen: Zeitleiste neu, gestreckt wird nur, wenn der Rand nicht reicht. */
async function applyEdit(res: EditResult) {
  if (busy) { status('Bitte warten, es läuft noch etwas …'); return; }
  if (!res.ok) { status(`Nicht möglich: ${res.error}`); return; }
  const wasPlaying = player?.playing ? player.position : null;
  player?.stop();
  busy = true;
  try {
    recipe = res.recipe;
    timeline = resolveTimeline(recipe, analyses);
    renderMixInfo();
    await prepare();
    status('Geändert.');
    if (wasPlaying !== null) await playFrom(wasPlaying);
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
  } finally {
    busy = false;
    renderMixInfo();
    renderMetrics();
  }
}

// ───────────── Strecken ─────────────
async function prepare() {
  if (!timeline) return;
  pool ??= new StretchPool();
  const t = performance.now();
  const files = new Map(items.map((it) => [it.id, it.file as Blob]));
  const res = await prepareStretched(timeline, analyses, files, pool, {
    existing: media,
    onTrack: (id, stage, f) => status(`Strecken: ${items.find((x) => x.id === id)?.title} – ${stage}${f !== undefined ? ` ${Math.round(f * 100)} %` : ''}`),
  });
  media = res.media;
  prepStats = res.stats;
  metrics.prepareWallMs = performance.now() - t;
  // Stretch-Worker freigeben (WASM-Heaps wachsen und schrumpfen nicht); bei Bedarf neu starten
  metrics.stretchWorkers = pool.size;
  pool.dispose();
  pool = null;
  renderMixInfo();
}

function audioBytes() {
  let b = 0;
  for (const m of media.values()) b += m.buffer.length * m.buffer.numberOfChannels * 4;
  return b;
}

async function recordMemory(label: string) {
  const r = await measureMemory();
  (metrics.memory ??= []).push({
    audioBuffersMB: audioBytes() / 1048576,
    browserMB: r.uaBytes !== undefined ? r.uaBytes / 1048576 : undefined,
    jsHeapMB: r.jsHeapBytes !== undefined ? r.jsHeapBytes / 1048576 : undefined,
    source: r.source,
    at: label,
  });
  renderMetrics();
}

// ───────────── Vorschau ─────────────
let raf = 0;
async function playFrom(sec: number) {
  if (!timeline || !media.size) return;
  player ??= new LivePlayer(MIX_SAMPLE_RATE);
  await player.play(timeline, media, sec);
  $<HTMLButtonElement>('stop').disabled = false;
  cancelAnimationFrame(raf);
  const tick = () => {
    if (!player?.playing || !timeline || !recipe) return;
    const p = player.position;
    const active = timeline.tracks.filter((t) => p >= t.mixStart && p < t.mixEnd).map((t) => recipe!.tracks[t.index].title);
    $('pos').textContent = `${fmtTime(p)} / ${fmtTime(timeline.duration)} · ${active.join(' + ')}`;
    raf = requestAnimationFrame(tick);
  };
  tick();
}

$('play').onclick = () => void playFrom(0).catch((e) => error(String(e)));
$('playFrom').onclick = () => void playFrom(Number($<HTMLInputElement>('seek').value) || 0).catch((e) => error(String(e)));
$('stop').onclick = () => { player?.stop(); cancelAnimationFrame(raf); };

// ───────────── Export ─────────────
$('export').onclick = async () => {
  if (!timeline) return;
  if (busy) { status('Bitte warten, es läuft noch etwas …'); return; }
  busy = true;
  player?.stop();
  const prog = $<HTMLProgressElement>('exportProgress');
  prog.hidden = false;
  const format = sel('format') as 'mp3' | 'wav';
  try {
    const sr = MIX_SAMPLE_RATE;
    const frames = Math.round(timeline.duration * sr);
    const sink: AudioSink = format === 'mp3' ? new Mp3Writer(sr, 2, 320) : new WavWriter(sr, 2, frames);
    const t = performance.now();
    const stats = await renderMix(timeline, media, {
      sampleRate: sr,
      sectionSec: 30,
      prerollSec: 2,
      onSection: async (chunk, k, count) => {
        await sink.push(chunk);
        prog.value = (k + 1) / count;
        $('exportInfo').textContent = `Abschnitt ${k + 1}/${count}`;
      },
    });
    $('exportInfo').textContent = format === 'mp3' ? 'Kodiere MP3 …' : '';
    const blob = await sink.finish();
    const totalMs = performance.now() - t;
    const name = `selectorz-spike-mix.${sink.extension}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.textContent = `${name} herunterladen (${(blob.size / 1048576).toFixed(1)} MB)`;
    metrics.render = {
      format: format === 'mp3' ? 'MP3 320 kbps CBR' : 'WAV 16 Bit',
      ms: stats.ms, totalMs, sections: stats.sections, realtimeFactor: timeline.duration / (totalMs / 1000), peak: sink.peak,
      clippedSamples: sink.clipped, peakSectionMB: stats.peakSectionBytes / 1048576, fileMB: blob.size / 1048576,
    };
    const info = $('exportInfo');
    info.textContent = `${metrics.render.format}: Rendern ${(stats.ms / 1000).toFixed(1)} s, gesamt ${(totalMs / 1000).toFixed(1)} s (${metrics.render.realtimeFactor.toFixed(0)}× Echtzeit), ${stats.sections} Abschnitte, Spitze ${dbStr(20 * Math.log10(sink.peak))}, übersteuert: ${sink.clipped} Samples · `;
    info.appendChild(a);
    void recordMemory('nach Export'); // läuft im Hintergrund, blockiert keine Knöpfe
  } catch (err) {
    error(`Export fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
  } finally {
    busy = false;
    renderMetrics();
    renderMixInfo();
  }
};

// ───────────── Gleichheitstests ─────────────
function diffLine(label: string, d: DiffStats) {
  const ok = d.maxDb < -60;
  return `${label}: max. Abweichung ${dbStr(d.maxDb)} (bei ${d.maxAtSec.toFixed(2)} s), RMS der Abweichung ${dbStr(d.rmsDb)} (Signal ${dbStr(d.signalRmsDb)}) → ${ok ? 'gleich (unter −60 dBFS)' : 'UNTERSCHIED'}`;
}

/** Fehler in Knopf-Aktionen sichtbar machen statt still hängen zu bleiben. */
const guarded = (fn: () => Promise<void>) => async () => {
  try {
    await fn();
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    status('');
  }
};

$('eqSections').onclick = guarded(async () => {
  if (!timeline?.transitions.length) return;
  const from = Math.max(0, timeline.transitions[0].start - 10);
  status('Gleichheitstest: Abschnitte vs. am Stück …');
  const d = await sectionEquality(timeline, media, MIX_SAMPLE_RATE, from, 40);
  (metrics.equality ??= {}).sections = d;
  $('eqResult').textContent = diffLine(`Abschnitte (4 × 10 s) vs. am Stück, ${fmtTime(from)} + 40 s`, d);
  status('');
  renderMetrics();
});

$('eqLive').onclick = guarded(async () => {
  if (!timeline?.transitions.length) return;
  const from = Math.max(0, timeline.transitions[0].bassSwap - 7);
  const seconds = 14;
  player ??= new LivePlayer(MIX_SAMPLE_RATE);
  status('Gleichheitstest: spiele 14 s live ab und schneide mit …');
  const live = await player.record(timeline, media, from, seconds);
  // Export ohne Vorlauf, damit beide Graphen aus dem Ruhezustand starten; die ersten 0,5 s
  // (Einschwingen des Limiters, der live schon vor dem Start läuft) zählen nicht.
  const offline = await renderToArrays(timeline, media, { sampleRate: MIX_SAMPLE_RATE, from, to: from + seconds, sectionSec: seconds + 1, prerollSec: 0 });
  const d = diffStats(offline, live, Math.round(0.5 * MIX_SAMPLE_RATE));
  (metrics.equality ??= {}).live = d;
  $('eqResult').textContent = diffLine(`Live-Mitschnitt vs. Export, ${fmtTime(from)} + ${seconds} s (über den Bass swap, ab 0,5 s verglichen)`, d);
  status('');
  renderMetrics();
});

// ───────────── Rezept ─────────────
$('toggleRecipe').onclick = () => {
  const pre = $('recipe');
  pre.hidden = !pre.hidden;
  $('toggleRecipe').textContent = pre.hidden ? 'Rezept (JSON) anzeigen' : 'Rezept ausblenden';
};
$('copyRecipe').onclick = async () => {
  if (recipe) { await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2)); status('Rezept kopiert.'); }
};

// ───────────── Messwerte ─────────────
function metricsJson() {
  return {
    engine: ENGINE_VERSION,
    userAgent: navigator.userAgent,
    crossOriginIsolated: globalThis.crossOriginIsolated,
    cores: navigator.hardwareConcurrency,
    tracks: analyses.map((a) => ({
      title: a.title, durationSec: +a.duration.toFixed(1), model: a.model, ep: a.executionProvider,
      decodeMs: Math.round(a.timings.decodeMs), featuresMs: Math.round(a.timings.featuresMs), inferenceMs: Math.round(a.timings.inferenceMs),
      analysisMs: Math.round(a.timings.totalMs), modelLoadMs: Math.round(a.timings.modelLoadMs), fromCache: !!a.fromCache,
      bpm: +a.bpm.toFixed(3), bpmMedian: +a.bpmMedian.toFixed(2), gridResidualMs: +a.grid.residualMs.toFixed(1), phaseShiftMs: +a.grid.phaseShiftMs.toFixed(1), inlierShare: +a.grid.inlierShare.toFixed(3),
      downbeatConfidence: +a.grid.downbeatConfidence.toFixed(2), bars: a.grid.barCount, phraseOffset: a.phraseOffset,
      introEndBar: a.introEndBar, introSource: a.introSource, outroStartBar: a.outroStartBar, outroSource: a.outroSource, loudness: +a.loudness.toFixed(1),
      compare: others.has(a.id) ? { model: others.get(a.id)!.model, inferenceMs: Math.round(others.get(a.id)!.timings.inferenceMs), bpm: +others.get(a.id)!.bpm.toFixed(3), ...compareAnalyses(a, others.get(a.id)!) } : undefined,
      stretch: prepStats.find((p) => p.id === a.id),
    })),
    recipe,
    mix: timeline
      ? {
          durationSec: +timeline.duration.toFixed(1),
          transitions: timeline.transitions.map((t) => ({ from: t.from, to: t.to, outBar: t.outBar, inBar: t.inBar, bars: t.bars, startSec: +t.start.toFixed(3) })),
          tracks: timeline.tracks.map((t) => {
            const a = analyses.find((x) => x.id === t.id)!;
            return { title: a.title, gridT0: a.grid.t0, gridPeriod: a.grid.period, stretch: t.stretch, sourceStart: t.sourceStart, sourceEnd: t.sourceEnd, mixStart: t.mixStart, mixEnd: t.mixEnd };
          }),
        }
      : undefined,
    ...metrics,
  };
}

function renderMetrics() {
  const rows: Array<[string, string]> = [];
  for (const a of analyses) rows.push([`Analyse: ${a.title}`, `${ms(a.timings.decodeMs)} dekodieren + ${ms(a.timings.totalMs)} Analyse (davon Inferenz ${ms(a.timings.inferenceMs)})`]);
  if (metrics.analysisWallMs !== undefined) rows.push(['Analyse gesamt (Wanduhr, inkl. Modell laden)', `${(metrics.analysisWallMs / 1000).toFixed(1)} s`]);
  for (const p of prepStats) rows.push([`Strecken: ${analyses.find((a) => a.id === p.id)?.title}`, p.reused ? 'wiederverwendet' : `${ms(p.decodeMs)} dekodieren + ${ms(p.stretchMs)} strecken, ${p.coveredSeconds.toFixed(0)} s Puffer, ${mb(p.bytes)}`]);
  if (metrics.prepareWallMs !== undefined) rows.push(['Strecken gesamt (Wanduhr)', `${(metrics.prepareWallMs / 1000).toFixed(1)} s (${metrics.stretchWorkers ?? 0} Worker parallel)`]);
  if (metrics.totalWallMs !== undefined) rows.push(['Ablegen bis hörbar (Analyse + Planung + Strecken)', `${(metrics.totalWallMs / 1000).toFixed(1)} s`]);
  if (metrics.render) {
    const r = metrics.render;
    rows.push([`Export (${r.format})`, `Rendern ${(r.ms / 1000).toFixed(1)} s, gesamt inkl. Kodieren ${(r.totalMs / 1000).toFixed(1)} s, ${r.realtimeFactor.toFixed(0)}× Echtzeit, ${r.sections} Abschnitte à 30 s (+2 s Vorlauf), je ${r.peakSectionMB.toFixed(0)} MB`]);
    rows.push(['Export-Pegel', `Spitze ${dbStr(20 * Math.log10(r.peak))}, übersteuerte Samples ${r.clippedSamples}, Datei ${r.fileMB.toFixed(0)} MB`]);
  }
  rows.push(['Gestreckte Audio-Puffer (eigene Rechnung)', mb(audioBytes())]);
  for (const m of metrics.memory ?? []) {
    rows.push([`Speicher ${m.at}`, `Browser: ${m.browserMB !== undefined ? `${m.browserMB.toFixed(0)} MB` : '–'} · JS-Heap: ${m.jsHeapMB !== undefined ? `${m.jsHeapMB.toFixed(0)} MB` : '–'} · Puffer: ${m.audioBuffersMB.toFixed(0)} MB (${m.source})`]);
  }
  if (metrics.equality?.sections) rows.push(['Gleichheit Abschnitte vs. am Stück', diffLine('', metrics.equality.sections).slice(2)]);
  if (metrics.equality?.live) rows.push(['Gleichheit Live vs. Export', diffLine('', metrics.equality.live).slice(2)]);
  table($('metricsTable'), ['Messwert', 'Wert'], rows);
}

$('clearCache').onclick = async () => { await clearAnalysisCache(); status('Analyse-Cache geleert.'); };
$('measureMem').onclick = () => void recordMemory('auf Knopfdruck');
$('copyMetrics').onclick = async () => {
  await navigator.clipboard.writeText(JSON.stringify(metricsJson(), null, 2));
  status('Messwerte kopiert.');
};

// ───────────── Ablauf ─────────────
function setReady(ready: boolean) {
  for (const id of ['play', 'playFrom', 'export', 'eqSections', 'eqLive']) $<HTMLButtonElement>(id).disabled = !ready;
  $<HTMLButtonElement>('replan').disabled = !analyses.length;
}

$('run').onclick = async () => {
  if (busy) return;
  if (!items.length) { error('Bitte zuerst Dateien ablegen.'); return; }
  busy = true;
  $('errors').textContent = '';
  setReady(false);
  player?.stop();
  media = new Map();
  prepStats = [];
  metrics.memory = [];
  metrics.render = undefined;
  metrics.equality = undefined;
  renderFiles();
  const t = performance.now();
  try {
    await analyzeAll();
    if (!analyses.length) throw new Error('Kein Track ließ sich analysieren.');
    doPlan();
    await prepare();
    metrics.totalWallMs = performance.now() - t;
    status('Fertig. Vorschau und Export bereit.');
    setReady(true);
    renderMixInfo();
    void recordMemory('nach dem Strecken'); // läuft im Hintergrund, blockiert keine Knöpfe
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    status('');
  } finally {
    busy = false;
    renderFiles();
    renderMetrics();
    setReady(media.size > 0);
    renderMixInfo();
  }
};

$('replan').onclick = async () => {
  if (busy || !analyses.length) return;
  busy = true;
  player?.stop();
  setReady(false);
  try {
    doPlan();
    status('Strecke neu, wo nötig …');
    await prepare();
    status('Neu geplant.');
    void recordMemory('nach Neuplanung'); // läuft im Hintergrund, blockiert keine Knöpfe
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
  } finally {
    busy = false;
    setReady(media.size > 0);
    renderMetrics();
    renderMixInfo();
  }
};

void showEnv();
renderMetrics();

// Für automatisierte Tests im Browser
(globalThis as unknown as { __spike: unknown }).__spike = {
  get analyses() { return analyses; },
  get recipe() { return recipe; },
  get timeline() { return timeline; },
  get media() { return media; },
  get player() { return (player ??= new LivePlayer(MIX_SAMPLE_RATE)); },
  metricsJson,
  renderToArrays,
  diffStats,
};
