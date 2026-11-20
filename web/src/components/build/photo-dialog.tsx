"use client";

import { useEffect, useRef, useState } from "react";
import { useClosable } from "@/components/use-closable";
import { AUTO, crop, renderHalftone, type Tune } from "@/lib/build/halftone";

type Props = { tint: string; dots: string; onUse: (dataUrl: string) => void; onClose: () => void };

const MAX_BYTES = 1024 * 1024;

// Foto wählen → im Browser zum Punkteraster → nur das Raster wird übernommen (Plan M1b, Variante 1).
export function PhotoDialog({ tint, dots, onUse, onClose: done }: Props) {
  const { closing, close } = useClosable(done);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [t, setT] = useState<Tune>(AUTO);
  const [mask, setMask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ x: number; y: number; t: Tune } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Raster neu zeichnen, sobald sich Foto oder Regler ändern (pro Frame höchstens einmal)
  useEffect(() => {
    if (!img) return;
    const id = requestAnimationFrame(() => {
      canvas.current ??= document.createElement("canvas");
      renderHalftone(img, t, canvas.current);
      setMask(canvas.current.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(id);
  }, [img, t]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (bmp.width < 200 || bmp.height < 200) throw new Error("small");
      setImg(bmp);
      setT(AUTO);
    } catch (e) {
      setError((e as Error).message === "small" ? "That photo is very small. Try a bigger one." : "This photo format doesn't work here. Try a JPG or PNG.");
    }
  }

  async function use() {
    if (!canvas.current) return;
    setBusy(true);
    const blob = (type: string, q?: number) => new Promise<Blob | null>((r) => canvas.current!.toBlob(r, type, q));
    let out = await blob("image/png");
    if (out && out.size > MAX_BYTES) out = await blob("image/webp", 0.92);
    if (!out || out.size > MAX_BYTES) {
      setBusy(false);
      setError("The dots got too detailed. Make the dots a little bigger and try again.");
      return;
    }
    const url = await new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result));
      fr.readAsDataURL(out);
    });
    onUse(url);
    close();
  }

  const slider = (key: keyof Tune, label: string, min: number, max: number, step: number, shown: string) => (
    <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
      <span className="flex justify-between">{label}<span className="label-mono text-[11px] text-ink-3">{shown}</span></span>
      <input type="range" min={min} max={max} step={step} value={t[key]} onChange={(e) => setT({ ...t, [key]: Number(e.target.value) })} className="w-full accent-ink" />
    </label>
  );

  return (
    <div className={`fixed inset-0 z-50 text-ink ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={close} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.55)] active:scale-100" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-title"
        className="sheet absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[22px] bg-bg md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(1000px,100vw)] md:rounded-none md:shadow-modal"
      >
        <header className="flex h-16 flex-none items-center gap-4 border-b border-line px-4 md:h-[68px] md:px-7">
          <h2 id="ph-title" className="text-[22px] font-extrabold tracking-[-0.03em]">Your photo</h2>
          <button onClick={close} className="ml-auto h-9 rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-semibold hover:bg-ink hover:text-night-t1">Close ✕</button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_340px] md:overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-4 bg-line-soft p-4 md:p-7">
            {mask ? (
              <div
                className="relative aspect-[4/5] w-full max-w-[384px] cursor-grab touch-none overflow-hidden rounded-[4px] active:cursor-grabbing"
                style={{ background: tint }}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  drag.current = { x: e.clientX, y: e.clientY, t };
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d || !img) return;
                  const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  // Verschiebung im Vorschaubild → Verschiebung des Ausschnitts im Original
                  const { sw, sh } = crop(img.width, img.height, d.t);
                  const x = d.t.x - ((e.clientX - d.x) / box.width) * (sw / img.width);
                  const y = d.t.y - ((e.clientY - d.y) / box.height) * (sh / img.height);
                  setT({ ...d.t, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
                }}
                onPointerUp={() => (drag.current = null)}
                onWheel={(e) => setT({ ...t, zoom: Math.min(2.5, Math.max(1, t.zoom - e.deltaY * 0.001)) })}
              >
                <div
                  role="img"
                  aria-label="Your photo as halftone preview"
                  className="absolute inset-0"
                  style={{ background: dots, WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}
                />
                <span className="label-mono pointer-events-none absolute inset-x-0 bottom-4 text-center text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">Drag to move · scroll to zoom</span>
              </div>
            ) : (
              <label className="flex aspect-[4/5] w-full max-w-[384px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[4px] border-[1.5px] border-dashed border-field-border bg-surface p-6 text-center hover:border-ink">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                <span className="text-[16px] font-semibold">Choose a photo</span>
                <span className="text-[13px] leading-[1.4] text-ink-3">A clear photo of you. It turns into dots in the colours of your look.</span>
                <input type="file" accept="image/*" className="sr-only" aria-label="Choose a photo" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
            )}
            {mask && slider("zoom", "Zoom", 1, 2.5, 0.05, `${Math.round(t.zoom * 100)}%`)}
          </div>

          <aside className="flex flex-col gap-5 border-line p-4 md:border-l md:p-6">
            <p className="rounded-s bg-surface p-3 text-[13px] leading-[1.45] text-ink-2">
              Only the dot version is saved. Your original photo stays on this device.
            </p>
            {error && <p key={error} role="alert" className="shake text-[13px] text-error-text">{error}</p>}
            {mask && (
              <>
                {slider("dot", "Dot size", 6, 24, 1, `${t.dot} PX`)}
                {slider("brightness", "Brightness", 0.6, 1.6, 0.05, t.brightness.toFixed(2))}
                {slider("contrast", "Contrast", 0.8, 2.2, 0.05, t.contrast.toFixed(2))}
                <button type="button" onClick={() => setT({ ...AUTO, x: t.x, y: t.y, zoom: t.zoom })} className="link-hover self-start text-[13px] font-semibold underline underline-offset-4">
                  Back to auto
                </button>
              </>
            )}
            <div className="mt-auto flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                disabled={!mask || busy}
                onClick={use}
                className="cta flex h-14 items-center justify-between rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none"
              >
                <span>{busy ? "Saving…" : "Use this photo"}</span>
                <span aria-hidden className="cta-arrow">→</span>
              </button>
              {mask && (
                <label className="link-hover cursor-pointer text-center text-[13px] font-semibold underline underline-offset-4">
                  Choose another photo
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
