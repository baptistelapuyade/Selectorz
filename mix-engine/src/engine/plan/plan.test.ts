import { describe, expect, it } from 'vitest';
import { masterTempo, phraseStarts, plan, type PlanTrack } from './plan';
import { BASS_CUT_DB, evalEnvelope, mixTimeOfBar, resolveTimeline } from './timeline';

/** Synthetischer, gut gebauter House-Track. */
function track(id: string, bpm: number, opts: Partial<PlanTrack> & { bars?: number } = {}): PlanTrack {
  const period = 60 / bpm;
  const bars = opts.bars ?? 192; // ~6 min bei 128 BPM
  const t0 = 0.12;
  return {
    id,
    title: id,
    bpm,
    duration: t0 + bars * 4 * period + 1.5,
    grid: { t0, period, beatsPerBar: 4, barCount: bars, residualMs: 3, inlierShare: 0.98, downbeatConfidence: 0.95, phaseShiftMs: 0 },
    phraseBars: 8,
    phraseOffset: 0,
    introEndBar: 32,
    outroStartBar: bars - 32,
    loudness: -8,
    ...opts,
  };
}

const six = () => [
  track('a', 124),
  track('b', 125, { loudness: -6.5 }),
  track('c', 123.5, { introEndBar: 16 }),
  track('d', 126, { phraseOffset: 4, introEndBar: 36, outroStartBar: 156 }),
  track('e', 124.5, { bars: 160, outroStartBar: 136 }),
  track('f', 125, { loudness: -10 }),
];

describe('masterTempo', () => {
  it('first / median / minimax', () => {
    const bpms = [122, 128, 124, 130];
    expect(masterTempo(bpms, 'first')).toBe(122);
    expect(masterTempo(bpms, 'median')).toBe(126);
    expect(masterTempo(bpms, 'minimax')).toBe(126);
    expect(masterTempo([120, 121, 140], 'minimax')).toBe(130);
    expect(masterTempo([120, 121, 140], 'median')).toBe(121);
  });

  it('minimax minimiert die größte relative Streckung', () => {
    const bpms = [118, 123, 131, 140];
    const worst = (m: number) => Math.max(...bpms.map((b) => Math.abs(b / m - 1)));
    const mm = masterTempo(bpms, 'minimax');
    for (const m of [masterTempo(bpms, 'first'), masterTempo(bpms, 'median'), 125, 130]) {
      expect(worst(mm)).toBeLessThanOrEqual(worst(m) + 1e-12);
    }
  });
});

describe('plan', () => {
  it('ist rein und deterministisch', () => {
    const input = six();
    const copy = JSON.parse(JSON.stringify(input));
    const a = plan(input);
    const b = plan(input);
    expect(a).toEqual(b);
    expect(input).toEqual(copy);
  });

  it('setzt Übergänge auf Phrasenanfänge im letzten Drittel und in Intros', () => {
    const tracks = six();
    const r = plan(tracks);
    expect(r.transitions).toHaveLength(5);
    for (const t of r.transitions) {
      const a = tracks[t.from];
      const b = tracks[t.from + 1];
      expect(phraseStarts(a)).toContain(t.outBar);
      expect(phraseStarts(b)).toContain(t.inBar);
      expect(t.outBar).toBeGreaterThanOrEqual(Math.ceil((2 / 3) * a.grid.barCount));
      expect(t.outBar + t.bars).toBeLessThanOrEqual(a.grid.barCount);
      expect([16, 32]).toContain(t.bars);
      expect(t.bassSwapBar).toBe(t.bars / 2);
      // der Übergang endet spätestens mit dem Intro des kommenden Tracks, wenn möglich
      if (b.introEndBar - t.bars >= b.phraseOffset) expect(t.inBar + t.bars).toBeLessThanOrEqual(b.introEndBar);
    }
  });

  it('nimmt den Outro-Beginn als Out-Takt, wenn er passt', () => {
    const tracks = [track('a', 124), track('b', 124)];
    const r = plan(tracks);
    expect(r.transitions[0].outBar).toBe(160);
    expect(r.transitions[0].bars).toBe(32);
    expect(r.transitions[0].inBar).toBe(0);
  });

  it('feste Übergangslänge wird respektiert', () => {
    const r = plan(six(), { transitionBars: 16 });
    expect(r.transitions.every((t) => t.bars === 16)).toBe(true);
  });

  it('warnt ab 6 % Streckung und schlägt ein besseres Master-Tempo vor', () => {
    const r = plan([track('a', 120), track('b', 121), track('c', 136)], { masterTempo: 'first' });
    expect(r.masterBpm).toBe(120);
    expect(r.warnings.some((w) => w.includes('+13.3 %'))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('Tempo-Vorschlag: 128.00'))).toBe(true);
  });

  it('gleicht die Lautheit an (begrenzt)', () => {
    const r = plan([track('a', 124, { loudness: -6 }), track('b', 124, { loudness: -12 }), track('c', 124, { loudness: -30 })]);
    expect(r.targetLoudness).toBe(-12);
    expect(r.tracks.map((t) => t.gainDb)).toEqual([-6, 0, 6]);
  });

  it('kurze Tracks: Übergänge überlappen nicht im selben Track', () => {
    const tracks = [track('a', 124), track('b', 124, { bars: 56, introEndBar: 16, outroStartBar: 40 }), track('c', 124)];
    const r = plan(tracks);
    const [t1, t2] = r.transitions;
    expect(t2.outBar).toBeGreaterThanOrEqual(t1.inBar + t1.bars);
  });
});

describe('resolveTimeline', () => {
  it('hält die Takte beider Tracks im Übergang exakt übereinander', () => {
    const tracks = six();
    const r = plan(tracks);
    const tl = resolveTimeline(r, tracks);
    for (const t of r.transitions) {
      for (let k = 0; k <= t.bars; k++) {
        const ta = mixTimeOfBar(tl, r, tracks, t.from, t.outBar + k);
        const tb = mixTimeOfBar(tl, r, tracks, t.from + 1, t.inBar + k);
        expect(Math.abs(ta - tb)).toBeLessThan(1e-9);
      }
    }
  });

  it('läuft nach der Streckung im Master-Tempo', () => {
    const tracks = six();
    const r = plan(tracks);
    const tl = resolveTimeline(r, tracks);
    tracks.forEach((_, i) => {
      const d = mixTimeOfBar(tl, r, tracks, i, 50) - mixTimeOfBar(tl, r, tracks, i, 49);
      expect(d).toBeCloseTo(tl.barSeconds, 9);
    });
  });

  it('Fader und Bass swap verlaufen wie vorgesehen', () => {
    const tracks = six();
    const r = plan(tracks);
    const tl = resolveTimeline(r, tracks);
    for (const tr of tl.transitions) {
      const a = tl.tracks[tr.from];
      const b = tl.tracks[tr.to];
      expect(evalEnvelope(b.fader, tr.start)).toBeCloseTo(0, 9);
      expect(evalEnvelope(b.fader, tr.bassSwap)).toBeCloseTo(1, 9);
      expect(evalEnvelope(a.fader, tr.bassSwap)).toBeCloseTo(1, 9);
      expect(evalEnvelope(a.fader, tr.end)).toBeCloseTo(0, 9);
      // vor dem Swap: Bass nur vom abgehenden Track, danach nur vom kommenden
      expect(evalEnvelope(a.lowShelfDb, tr.bassSwap - 1)).toBe(0);
      expect(evalEnvelope(b.lowShelfDb, tr.bassSwap - 1)).toBe(BASS_CUT_DB);
      expect(evalEnvelope(a.lowShelfDb, tr.bassSwap + 1)).toBe(BASS_CUT_DB);
      expect(evalEnvelope(b.lowShelfDb, tr.bassSwap + 1)).toBe(0);
      expect(tr.end - tr.start).toBeCloseTo(tr.bars * tl.barSeconds, 9);
    }
  });

  it('nie mehr als zwei Tracks gleichzeitig, Dauer stimmt', () => {
    const tracks = six();
    const r = plan(tracks);
    const tl = resolveTimeline(r, tracks);
    for (let t = 0; t < tl.duration; t += 0.5) {
      const active = tl.tracks.filter((x) => t >= x.mixStart && t < x.mixEnd).length;
      expect(active).toBeLessThanOrEqual(2);
      expect(active).toBeGreaterThanOrEqual(1);
    }
    expect(tl.duration).toBe(tl.tracks[tl.tracks.length - 1].mixEnd);
    // Stretch = bpm / master
    tl.tracks.forEach((t, i) => expect(t.stretch).toBeCloseTo(tracks[i].bpm / r.masterBpm, 12));
  });

  it('Raster-Korrektur („Set the one here“) verschiebt den Einstieg um ganze Beats', () => {
    const tracks = [track('a', 124), track('b', 124)];
    const r = plan(tracks);
    const base = resolveTimeline(r, tracks).tracks[1].sourceStart;
    r.tracks[1].gridShiftBeats = 1;
    const shifted = resolveTimeline(r, tracks).tracks[1].sourceStart;
    expect(shifted - base).toBeCloseTo(60 / 124, 9);
  });
});

describe('evalEnvelope', () => {
  it('interpoliert linear und hält außen', () => {
    const env: Array<[number, number]> = [[1, 0], [3, 1], [4, 1], [5, 0]];
    expect(evalEnvelope(env, 0)).toBe(0);
    expect(evalEnvelope(env, 2)).toBe(0.5);
    expect(evalEnvelope(env, 3.5)).toBe(1);
    expect(evalEnvelope(env, 4.5)).toBe(0.5);
    expect(evalEnvelope(env, 9)).toBe(0);
  });
});
