// Vorschau im Browser: derselbe Graph wie beim Export, nur in einem AudioContext.
// Optional mit Mitschnitt (AudioWorklet), um Live gegen Offline zu vergleichen.
import type { Timeline } from '../types';
import { alignDown, buildMixGraph, QUANTUM, type MixGraph, type StretchedTrack } from './mixGraph';

const TAP_SOURCE = `
class SelectorzTap extends AudioWorkletProcessor {
  process(inputs) {
    const i = inputs[0];
    if (i && i.length) this.port.postMessage([currentFrame, i[0].slice(), (i[1] || i[0]).slice()]);
    return true;
  }
}
registerProcessor('selectorz-tap', SelectorzTap);
`;

export class LivePlayer {
  readonly ctx: AudioContext;
  private graph: MixGraph | null = null;
  private ctxStart = 0;
  private mixFrom = 0;
  private tapReady: Promise<void> | null = null;

  constructor(readonly sampleRate: number) {
    // gleiche Rate wie die Puffer: kein Resampling im Graphen, gleiche Rechnung wie offline
    this.ctx = new AudioContext({ sampleRate, latencyHint: 'playback' });
  }

  get playing() {
    return !!this.graph;
  }

  /** Aktuelle Mix-Position in Sekunden. */
  get position() {
    return this.graph ? this.mixFrom + Math.max(0, this.ctx.currentTime - this.ctxStart) : this.mixFrom;
  }

  async play(tl: Timeline, media: Map<string, StretchedTrack>, fromSec: number, tap?: AudioNode): Promise<{ startFrame: number }> {
    this.stop();
    await this.ctx.resume();
    const sr = this.sampleRate;
    // gleiche Ausrichtung wie beim Export: Fensteranfang auf ein Render-Quantum
    this.mixFrom = alignDown(Math.max(0, Math.round(fromSec * sr))) / sr;
    const startFrame = Math.ceil(((this.ctx.currentTime + 0.25) * sr) / QUANTUM) * QUANTUM;
    this.ctxStart = startFrame / sr;
    this.graph = buildMixGraph(this.ctx, tl, media, { mixFrom: this.mixFrom, mixTo: tl.duration, ctxStart: this.ctxStart });
    this.graph.output.connect(this.ctx.destination);
    if (tap) this.graph.output.connect(tap);
    return { startFrame };
  }

  stop() {
    if (this.graph) {
      this.mixFrom = this.position;
      this.graph.disconnect();
      this.graph = null;
    }
  }

  /** Spielt `seconds` ab `fromSec` und schneidet die Ausgabe sample-genau mit. */
  async record(tl: Timeline, media: Map<string, StretchedTrack>, fromSec: number, seconds: number): Promise<Float32Array[]> {
    this.tapReady ??= this.ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP_SOURCE], { type: 'text/javascript' })));
    await this.tapReady;
    const tap = new AudioWorkletNode(this.ctx, 'selectorz-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = new GainNode(this.ctx, { gain: 0 });
    tap.connect(mute).connect(this.ctx.destination);
    const frames = Math.round(seconds * this.sampleRate);
    const out = [new Float32Array(frames), new Float32Array(frames)];
    let startFrame = Infinity;
    let filledTo = 0;
    const done = new Promise<void>((resolve) => {
      tap.port.onmessage = (e: MessageEvent<[number, Float32Array, Float32Array]>) => {
        const [frame, l, r] = e.data;
        const off = frame - startFrame;
        if (!Number.isFinite(off)) return;
        for (let i = 0; i < l.length; i++) {
          const j = off + i;
          if (j >= 0 && j < frames) { out[0][j] = l[i]; out[1][j] = r[i]; filledTo = Math.max(filledTo, j + 1); }
        }
        if (filledTo >= frames) resolve();
      };
    });
    const res = await this.play(tl, media, fromSec, tap);
    startFrame = res.startFrame;
    await done;
    this.stop();
    tap.disconnect();
    mute.disconnect();
    return out;
  }
}
