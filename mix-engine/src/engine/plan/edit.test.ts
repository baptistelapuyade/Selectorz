import { describe, expect, it } from 'vitest';
import { editTransition, shiftGrid, validateRecipe } from './edit';
import { plan, type PlanTrack } from './plan';
import { BASS_CUT_DB, evalEnvelope, mixTimeOfBar, resolveTimeline } from './timeline';

function track(id: string, bpm: number, bars = 192): PlanTrack {
  const period = 60 / bpm;
  return {
    id, title: id, bpm, duration: 0.1 + bars * 4 * period + 1,
    grid: { t0: 0.1, period, beatsPerBar: 4, barCount: bars, residualMs: 2, inlierShare: 0.99, downbeatConfidence: 0.9, phaseShiftMs: 0 },
    phraseBars: 8, phraseOffset: 0, introEndBar: 32, outroStartBar: bars - 32, loudness: -9,
  };
}

const tracks = [track('a', 124), track('b', 125), track('c', 126)];

describe('editTransition', () => {
  it('verschiebt Out/In taktweise, ändert Länge und Stil, markiert als geändert', () => {
    const r = plan(tracks);
    const res = editTransition(r, tracks, 0, { outBarDelta: -8, inBarDelta: 1, bars: 16, style: 'quick', bassSwap: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const t = res.recipe.transitions[0];
    expect(t.outBar).toBe(r.transitions[0].outBar - 8);
    expect(t.inBar).toBe(r.transitions[0].inBar + 1);
    expect(t.bars).toBe(16);
    expect(t.bassSwapBar).toBe(8);
    expect(t.style).toBe('quick');
    expect(t.bassSwap).toBe(false);
    expect(t.edited).toBe(true);
    expect(r.transitions[0].edited).toBe(false); // Original unverändert
  });

  it('nach einer Verschiebung bleiben die Takte im Übergang deckungsgleich', () => {
    const r0 = plan(tracks);
    const res = editTransition(r0, tracks, 0, { outBarDelta: -8, inBarDelta: 3 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.recipe;
    const tl = resolveTimeline(r, tracks);
    const t = r.transitions[0];
    for (let k = 0; k <= t.bars; k++) {
      expect(mixTimeOfBar(tl, r, tracks, 0, t.outBar + k)).toBeCloseTo(mixTimeOfBar(tl, r, tracks, 1, t.inBar + k), 9);
    }
  });

  it('lehnt Übergänge über das Trackende hinaus ab', () => {
    const r = plan(tracks);
    const res = editTransition(r, tracks, 0, { outBarDelta: 200 });
    expect(res.ok).toBe(false);
  });

  it('lehnt Überlappung mit dem vorherigen Übergang ab', () => {
    const r = plan(tracks);
    // Track b: rein bei inBar..inBar+bars; raus darf nicht davor beginnen
    const t1 = r.transitions[1];
    const res = editTransition(r, tracks, 1, { outBarDelta: -(t1.outBar - 1) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/beginnt, bevor/);
  });

  it('erlaubt nur 8/16/32/64 Takte', () => {
    const r = plan(tracks);
    r.transitions[0].bars = 12;
    expect(validateRecipe(r, tracks)).toMatch(/nicht erlaubt/);
  });
});

describe('shiftGrid („Set the one here“)', () => {
  it('verschiebt den Einstieg des Tracks um einen Beat', () => {
    const r = plan(tracks);
    const res = shiftGrid(r, tracks, 1, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = resolveTimeline(r, tracks).tracks[1];
    const b = resolveTimeline(res.recipe, tracks).tracks[1];
    expect(b.sourceStart - a.sourceStart).toBeCloseTo(60 / 125, 9);
    expect(b.mixStart).toBeCloseTo(a.mixStart, 9); // im Mix bleibt der Einsatz an derselben Stelle
  });

  it('nicht vor den Dateianfang', () => {
    const r = plan(tracks);
    expect(shiftGrid(r, tracks, 0, -4).ok).toBe(false);
  });
});

describe('Stile in der Zeitleiste', () => {
  const swapState = (style: 'blend' | 'quick' | 'cut', bassSwap = true) => {
    const r = plan(tracks.slice(0, 2));
    r.transitions[0].style = style;
    r.transitions[0].bassSwap = bassSwap;
    const tl = resolveTimeline(r, tracks.slice(0, 2));
    return { tl, t: tl.transitions[0], a: tl.tracks[0], b: tl.tracks[1] };
  };

  it('cut: harter Wechsel auf der Eins, kein Low-Shelf', () => {
    const { t, a, b } = swapState('cut');
    expect(evalEnvelope(b.fader, t.bassSwap - 0.1)).toBe(0);
    expect(evalEnvelope(b.fader, t.bassSwap + 0.1)).toBe(1);
    expect(evalEnvelope(a.fader, t.bassSwap - 0.1)).toBe(1);
    expect(evalEnvelope(a.fader, t.bassSwap + 0.1)).toBe(0);
    expect(evalEnvelope(b.lowShelfDb, t.bassSwap - 1)).toBe(0);
  });

  it('quick: je ein Takt um den Wechsel', () => {
    const { tl, t, a, b } = swapState('quick');
    expect(evalEnvelope(b.fader, t.bassSwap - tl.barSeconds - 0.01)).toBe(0);
    expect(evalEnvelope(b.fader, t.bassSwap)).toBeCloseTo(1, 9);
    expect(evalEnvelope(a.fader, t.bassSwap + tl.barSeconds + 0.01)).toBeCloseTo(0, 9);
    expect(evalEnvelope(b.lowShelfDb, t.bassSwap - 1)).toBe(BASS_CUT_DB);
  });

  it('blend ohne Bass swap: beide Bässe bleiben', () => {
    const { t, a, b } = swapState('blend', false);
    expect(evalEnvelope(b.lowShelfDb, t.bassSwap - 1)).toBe(0);
    expect(evalEnvelope(a.lowShelfDb, t.bassSwap + 1)).toBe(0);
  });
});
