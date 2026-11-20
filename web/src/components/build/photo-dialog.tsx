"use client";

import { useEffect, useRef, useState } from "react";
import { useClosable } from "@/components/use-closable";
import type { DraftPhoto } from "@/lib/build/draft";
import { AUTO, crop, renderBw, renderHalftone, type Tune } from "@/lib/build/halftone";

type Props = { look: "day" | "night"; tint: string; dots: string; start?: DraftPhoto["style"]; onUse: (photo: DraftPhoto) => void; onClose: () => void };

const MAX_BYTES = 1024 * 1024;

// Foto wählen → im Browser zum Punkteraster (oder Schwarz-Weiß) → nur das Ergebnis wird übernommen (Plan M1b, Variante 1).
export function PhotoDialog({ look, tint, dots, start = "dots", onUse, onClose: done }: Props) {
  const [style, setStyle] = useState<DraftPhoto["style"]>(start);
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
      if (style === "bw") {
        renderBw(img, t, canvas.current);
        setMask(canvas.current.toDataURL("image/jpeg", 0.8));
      } else {
        renderHalftone(img, t, canvas.current, look === "night");
        setMask(canvas.current.toDataURL("image/png"));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [img, t, style, look]);

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

  // Bilder in der Endgröße erzeugen: Raster als zwei Masken (Day = Schatten, Night = Licht), sonst Schwarz-Weiß
  async function use() {
    if (!img) return;
    setBusy(true);
    const c = document.createElement("canvas");
    const encode = async (type: string, q?: number) => {
      const b = await new Promise<Blob | null>((r) => c.toBlob(r, type, q));
      return b && b.size <= MAX_BYTES ? b : null;
    };
    const toUrl = (b: Blob) =>
      new Promise<string>((r) => {
        const fr = new FileReader();
        fr.onload = () => r(String(fr.result));
        fr.readAsDataURL(b);
      });
    let photo: DraftPhoto | null = null;
    if (style === "bw") {
      renderBw(img, t, c);
      const b = (await encode("image/webp", 0.85)) ?? (await encode("image/png"));
      if (b) photo = { style: "bw", bw: await toUrl(b) };
    } else {
      renderHalftone(img, t, c, false);
      const day = (await encode("image/png")) ?? (await encode("image/webp", 0.92));
      renderHalftone(img, t, c, true);
      const night = (await encode("image/png")) ?? (await encode("image/webp", 0.92));
      if (day && night) photo = { style: "dots", day: await toUrl(day), night: await toUrl(night) };
    }
    if (!photo) {
      setBusy(false);
      setError("The photo got too detailed. Make the dots a little bigger and try again.");
      return;
    }
    onUse(photo);
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
                style={{ background: style === "bw" ? "#111111" : tint }}
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
                {style === "bw" ? (
                  <div role="img" aria-label="Your photo as black and white preview" className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${mask})` }} />
                ) : (
                  <div
                    role="img"
                    aria-label="Your photo as halftone preview"
                    className="absolute inset-0"
                    style={{ background: dots, WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}
                  />
                )}
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
              {style === "dots"
                ? "Only the dot version is saved. Your original photo stays on this device."
                : "A black and white copy is saved, cropped like you see it. The original stays on this device."}
            </p>
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold" id="style-label">Style</span>
              <span role="radiogroup" aria-labelledby="style-label" className="grid h-11 grid-cols-2 rounded-full bg-line-soft p-1">
                {(["dots", "bw"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={style === v}
                    onClick={() => setStyle(v)}
                    className={`rounded-full text-[13px] font-semibold ${style === v ? "bg-ink text-night-t1" : "hover:bg-[rgba(17,17,17,0.06)]"}`}
                  >
                    {v === "dots" ? "Dot matrix" : "Black and white"}
                  </button>
                ))}
              </span>
              <span className="text-[12px] leading-[1.4] text-ink-3">
                {style === "dots" ? "Your photo in the colours of your look. Recommended." : "Plain black and white, if the dots don't feel like you."}
              </span>
            </div>
            {error && <p key={error} role="alert" className="shake text-[13px] text-error-text">{error}</p>}
            {mask && (
              <>
                {style === "dots" && slider("dot", "Dot size", 6, 24, 1, `${t.dot} PX`)}
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
