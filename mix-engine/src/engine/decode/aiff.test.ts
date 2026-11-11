import { describe, expect, it } from 'vitest';
import { isAiff, parseAiff } from './aiff';
import { WavWriter } from '../encode/wav';

/** Baut eine AIFF/AIFF-C-Datei mit 2 Kanälen. */
function buildAiff(samples: number[][], bits: 16 | 24, compression?: 'NONE' | 'sowt', rate = 44100): ArrayBuffer {
  const ch = samples.length;
  const frames = samples[0].length;
  const bps = bits / 8;
  const aifc = !!compression;
  const commSize = aifc ? 18 + 4 + 2 : 18;
  const ssndSize = 8 + frames * ch * bps;
  const total = 12 + 8 + commSize + 8 + ssndSize;
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'FORM'); v.setUint32(4, total - 8); str(8, aifc ? 'AIFC' : 'AIFF');
  let o = 12;
  str(o, 'COMM'); v.setUint32(o + 4, commSize);
  v.setUint16(o + 8, ch); v.setUint32(o + 10, frames); v.setUint16(o + 14, bits);
  // 44100 als 80-Bit Extended: Exponent 16383+15, Mantisse 44100 << 48
  const e = Math.floor(Math.log2(rate));
  v.setUint16(o + 16, 16383 + e);
  const mant = rate / 2 ** e; // 1.x
  v.setUint32(o + 18, Math.floor(mant * 2 ** 31));
  v.setUint32(o + 22, 0);
  if (aifc) { str(o + 26, compression!); v.setUint8(o + 30, 0); }
  o += 8 + commSize;
  str(o, 'SSND'); v.setUint32(o + 4, ssndSize); v.setUint32(o + 8, 0); v.setUint32(o + 12, 0);
  let p = o + 16;
  const little = compression === 'sowt';
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const x = Math.round(samples[c][i] * (bits === 16 ? 32767 : 8388607));
      if (bits === 16) v.setInt16(p, x, little);
      else { const u = x & 0xffffff; const bytes = [(u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff]; (little ? bytes.reverse() : bytes).forEach((b, k) => v.setUint8(p + k, b)); }
      p += bps;
    }
  }
  return buf;
}

describe('AIFF', () => {
  const l = [0, 0.5, -0.5, 0.25, -1 + 1e-4];
  const r = [0.1, -0.1, 0.9, -0.9, 0];
  for (const [bits, comp] of [[16, undefined], [24, undefined], [16, 'sowt'], [24, 'NONE']] as const) {
    it(`${bits} Bit ${comp ?? 'AIFF'}`, () => {
      const buf = buildAiff([l, r], bits, comp);
      expect(isAiff(buf)).toBe(true);
      const pcm = parseAiff(buf);
      expect(pcm.sampleRate).toBe(44100);
      expect(pcm.channels).toHaveLength(2);
      pcm.channels[0].forEach((x, i) => expect(x).toBeCloseTo(l[i], 3));
      pcm.channels[1].forEach((x, i) => expect(x).toBeCloseTo(r[i], 3));
    });
  }
  it('erkennt Nicht-AIFF', () => {
    expect(isAiff(new ArrayBuffer(4))).toBe(false);
  });
});

describe('WavWriter', () => {
  it('schreibt Kopf, Daten und zählt Übersteuerung', async () => {
    const w = new WavWriter(44100, 2, 4);
    w.push([new Float32Array([0, 0.5]), new Float32Array([1.5, -0.5])]);
    w.push([new Float32Array([-1, 0.25, 9]), new Float32Array([0, 0, 0])]);
    const blob = w.finish();
    const v = new DataView(await blob.arrayBuffer());
    expect(blob.size).toBe(44 + 4 * 2 * 2);
    expect(v.getUint32(40, true)).toBe(16);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getInt16(44 + 2, true)).toBe(32767); // 1.5 → begrenzt
    expect(v.getInt16(44 + 8, true)).toBe(-32768);
    expect(w.clipped).toBe(1);
    expect(w.peak).toBe(1.5);
  });
});
