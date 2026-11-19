import { describe, expect, it } from 'vitest';
import { stretchChannels } from './stretchCore';

const SR = 44100;

function clicks(seconds: number, every: number, offset: number): Float32Array {
  const x = new Float32Array(Math.round(seconds * SR));
  for (let t = offset; t < seconds - 0.1; t += every) x[Math.round(t * SR)] = 1;
  return x;
}

function peakNear(x: Float32Array, at: number, radius = 2000): number {
  let best = -1;
  let bv = 0;
  for (let i = Math.max(0, Math.floor(at - radius)); i < Math.min(x.length, at + radius); i++) {
    if (Math.abs(x[i]) > bv) { bv = Math.abs(x[i]); best = i; }
  }
  return best;
}

describe('stretchChannels (Signalsmith, offline)', () => {
  for (const factor of [1.03, 0.97, 1.06]) {
    it(`Faktor ${factor}: Länge exakt, Transienten zeitrichtig (< 1 ms)`, async () => {
      const x = clicks(8, 0.48, 0.05);
      const [l, r] = await stretchChannels([x, x], SR, factor);
      expect(l.length).toBe(Math.round(x.length * factor));
      expect(r.length).toBe(l.length);
      for (let t = 0.05; t < 7.5; t += 0.48) {
        const expected = Math.round(t * SR) * factor;
        const got = peakNear(l, expected);
        expect(Math.abs(got - expected)).toBeLessThan(SR * 0.001);
      }
    });
  }
});
