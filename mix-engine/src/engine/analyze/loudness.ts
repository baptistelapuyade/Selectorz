// Integrierte Lautheit nach ITU-R BS.1770 (K-Gewichtung, 400-ms-Blöcke, Gates −70 LUFS
// und −10 LU). Hier auf Mono bei beliebiger Abtastrate; für die relative Angleichung
// zwischen Tracks genügt das.

interface Biquad {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

function kWeighting(fs: number): [Biquad, Biquad] {
  // Stufe 1: High-Shelf (+4 dB um 1,68 kHz)
  let G = 3.999843853973347;
  let fc = 1681.974450955533;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * fc) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stufe 2: Hochpass (RLB, ~38 Hz)
  fc = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * fc) / fs);
  a0 = 1 + K / Q + K * K;
  const hp: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

function filter(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = f.b0 * xi + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

/** Integrierte Lautheit in LUFS (−Infinity bei Stille). */
export function integratedLoudness(pcm: Float32Array, sampleRate: number): number {
  const [shelf, hp] = kWeighting(sampleRate);
  const y = filter(filter(pcm, shelf), hp);
  const block = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate);
  const z: number[] = [];
  for (let s = 0; s + block <= y.length; s += step) {
    let acc = 0;
    for (let i = s; i < s + block; i++) acc += y[i] * y[i];
    z.push(acc / block);
  }
  const lk = (ms: number) => -0.691 + 10 * Math.log10(ms);
  const abs = z.filter((v) => lk(v) > -70);
  if (!abs.length) return -Infinity;
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((v) => lk(v) > rel);
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length);
}
