// Gestreckte Puffer vorbereiten: Datei neu dekodieren (44,1 kHz Stereo), nur den
// benötigten Bereich plus Rand ausschneiden, Original verwerfen, im Worker strecken.
// Der Rand erlaubt dem Editor später, Übergänge zu verschieben, ohne neu zu strecken.
import { decodeFile, toStereo } from './decode/decode';
import type { StretchedTrack } from './graph/mixGraph';
import { covers } from './graph/mixGraph';
import type { StretchPool } from './stretch/client';
import type { Timeline, TrackAnalysis } from './types';

export const MIX_SAMPLE_RATE = 44100;

export interface PrepareStats {
  id: string;
  reused: boolean;
  decodeMs: number;
  stretchMs: number;
  /** Bytes des gestreckten Puffers (Float32, Stereo). */
  bytes: number;
  coveredSeconds: number;
}

export async function prepareStretched(
  tl: Timeline,
  analyses: TrackAnalysis[],
  files: Map<string, Blob>,
  pool: StretchPool,
  opts: {
    existing?: Map<string, StretchedTrack>;
    marginBars?: number;
    onTrack?: (id: string, stage: 'decode' | 'stretch' | 'done', fraction?: number) => void;
  } = {},
): Promise<{ media: Map<string, StretchedTrack>; stats: PrepareStats[] }> {
  const sr = MIX_SAMPLE_RATE;
  const media = new Map<string, StretchedTrack>();
  const stats: PrepareStats[] = [];
  const marginBars = opts.marginBars ?? 32;
  const jobs: Promise<void>[] = [];
  let inFlight = 0;
  const waiters: Array<() => void> = [];
  const acquire = async () => {
    while (inFlight >= pool.size) await new Promise<void>((r) => waiters.push(r));
    inFlight++;
  };
  const release = () => {
    inFlight--;
    waiters.shift()?.();
  };

  for (const tr of tl.tracks) {
    const a = analyses.find((x) => x.id === tr.id)!;
    const prev = opts.existing?.get(tr.id);
    if (prev && covers(prev, tr.sourceStart, tr.sourceEnd, tr.stretch)) {
      media.set(tr.id, prev);
      stats.push({ id: tr.id, reused: true, decodeMs: 0, stretchMs: 0, bytes: prev.buffer.length * prev.buffer.numberOfChannels * 4, coveredSeconds: prev.coverEnd - prev.coverStart });
      continue;
    }
    await acquire();
    const margin = marginBars * 4 * a.grid.period;
    opts.onTrack?.(tr.id, 'decode');
    const t = performance.now();
    const file = files.get(tr.id);
    if (!file) throw new Error(`Datei für ${tr.id} fehlt`);
    let pcm = toStereo(await decodeFile(file, sr));
    const n = pcm.channels[0].length;
    const f0 = Math.max(0, Math.floor((tr.sourceStart - margin) * sr));
    const f1 = Math.min(n, Math.ceil((tr.sourceEnd + margin) * sr));
    const region = pcm.channels.map((c) => c.slice(f0, f1));
    pcm = { sampleRate: sr, channels: [] }; // Original freigeben
    const decodeMs = performance.now() - t;
    opts.onTrack?.(tr.id, 'stretch', 0);

    jobs.push(
      pool
        .stretch(region, sr, tr.stretch, (f) => opts.onTrack?.(tr.id, 'stretch', f))
        .then(({ channels, ms }) => {
          const buffer = new AudioBuffer({ length: channels[0].length, numberOfChannels: 2, sampleRate: sr });
          channels.forEach((c, i) => buffer.copyToChannel(c as Float32Array<ArrayBuffer>, i));
          const st: StretchedTrack = { id: tr.id, buffer, coverStart: f0 / sr, coverEnd: f1 / sr, stretch: tr.stretch };
          media.set(tr.id, st);
          stats.push({ id: tr.id, reused: false, decodeMs, stretchMs: ms, bytes: buffer.length * 2 * 4, coveredSeconds: (f1 - f0) / sr });
          opts.onTrack?.(tr.id, 'done', 1);
        })
        .finally(release),
    );
  }
  await Promise.all(jobs);
  stats.sort((x, y) => tl.tracks.findIndex((t) => t.id === x.id) - tl.tracks.findIndex((t) => t.id === y.id));
  return { media, stats };
}
