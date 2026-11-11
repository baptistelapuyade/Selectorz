// Minimaler AIFF/AIFF-C-Parser (Chrome und Firefox dekodieren AIFF nicht nativ).
// Unterstützt PCM 8/16/24/32 Bit (big endian, „NONE“/„twos“), „sowt“ (little endian)
// sowie „fl32“/„fl64“.
import type { Pcm } from '../types';

export function isAiff(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const v = new DataView(bytes);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  return tag(0) === 'FORM' && (tag(8) === 'AIFF' || tag(8) === 'AIFC');
}

/** IEEE 754 80-Bit Extended (big endian) → number. */
function readExtended(v: DataView, o: number): number {
  const expon = v.getUint16(o) & 0x7fff;
  const sign = v.getUint16(o) & 0x8000 ? -1 : 1;
  const hi = v.getUint32(o + 2);
  const lo = v.getUint32(o + 6);
  if (expon === 0 && hi === 0 && lo === 0) return 0;
  return sign * (hi * 2 ** (expon - 16383 - 31) + lo * 2 ** (expon - 16383 - 63));
}

export function parseAiff(bytes: ArrayBuffer): Pcm {
  const v = new DataView(bytes);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (!isAiff(bytes)) throw new Error('Keine AIFF-Datei');
  const isAifc = tag(8) === 'AIFC';
  let channels = 0, frames = 0, bits = 0, rate = 0;
  let comp = 'NONE';
  let dataOffset = -1;
  let o = 12;
  while (o + 8 <= bytes.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4);
    const body = o + 8;
    if (id === 'COMM') {
      channels = v.getUint16(body);
      frames = v.getUint32(body + 2);
      bits = v.getUint16(body + 6);
      rate = readExtended(v, body + 8);
      if (isAifc && size >= 22) comp = tag(body + 18);
    } else if (id === 'SSND') {
      dataOffset = body + 8 + v.getUint32(body);
    }
    o = body + size + (size & 1);
  }
  if (!channels || !rate || dataOffset < 0) throw new Error('AIFF unvollständig (COMM/SSND fehlt)');
  const c = comp.toLowerCase();
  const little = c === 'sowt';
  const float = c === 'fl32' || c === 'fl64';
  if (!['none', 'twos', 'sowt', 'fl32', 'fl64'].includes(c)) throw new Error(`AIFF-C-Kompression „${comp}“ wird nicht unterstützt`);
  const bytesPer = float ? (c === 'fl64' ? 8 : 4) : Math.ceil(bits / 8);
  const avail = Math.floor((bytes.byteLength - dataOffset) / (bytesPer * channels));
  frames = Math.min(frames, avail);
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  let p = dataOffset;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      let s: number;
      if (float) s = bytesPer === 8 ? v.getFloat64(p, little) : v.getFloat32(p, little);
      else if (bytesPer === 1) s = v.getInt8(p) / 128;
      else if (bytesPer === 2) s = v.getInt16(p, little) / 32768;
      else if (bytesPer === 3) {
        const b0 = v.getUint8(p), b1 = v.getUint8(p + 1), b2 = v.getUint8(p + 2);
        let x = little ? b0 | (b1 << 8) | (b2 << 16) : (b0 << 16) | (b1 << 8) | b2;
        if (x & 0x800000) x -= 0x1000000;
        s = x / 8388608;
      } else s = v.getInt32(p, little) / 2147483648;
      out[ch][i] = s;
      p += bytesPer;
    }
  }
  return { sampleRate: rate, channels: out };
}
