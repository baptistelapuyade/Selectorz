"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mmss } from "@/lib/profile";
import { bandcampEmbedSrc, seekTarget, soundcloudWidgetSrc } from "@/lib/lab/deck";
import { LAB_MIX, LAB_TRACKS, type LabTrack } from "@/lib/lab/deck-tracks";

// Labor „Deck“: Kiste aus Board „Kopf v5d“ mit echtem, sichtbarem Player (YouTube/Bandcamp/SoundCloud).
// Regeln: offizieller Player sichtbar und nicht überdeckt, Steuerung nur über die offiziellen APIs,
// nichts lädt vor der Einwilligung (Zwei-Klick, MEDIA-07/09).

type Provider = "youtube" | "bandcamp" | "soundcloud";
type YTPlayer = {
  playVideo(): void; pauseVideo(): void; seekTo(s: number, allow: boolean): void;
  loadVideoById(o: { videoId: string; startSeconds: number }): void;
  getCurrentTime(): number; getDuration(): number; destroy(): void;
};
type YTApi = { Player: new (el: HTMLElement, opts: object) => YTPlayer };
type SCWidget = { bind(e: string, fn: () => void): void; play(): void; seekTo(ms: number): void };
type SCApi = { Widget: ((el: HTMLIFrameElement) => SCWidget) & { Events: { READY: string } } };

let ytLoad: Promise<YTApi> | null = null;
function youtubeApi(): Promise<YTApi> {
  const w = window as unknown as { YT?: YTApi & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  ytLoad ??= new Promise((resolve, reject) => {
    w.onYouTubeIframeAPIReady = () => resolve(w.YT!);
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => { ytLoad = null; reject(new Error("YouTube API")); };
    document.head.appendChild(s);
  });
  return ytLoad;
}

let scLoad: Promise<SCApi> | null = null;
function soundcloudApi(): Promise<SCApi> {
  const w = window as unknown as { SC?: SCApi };
  if (w.SC?.Widget) return Promise.resolve(w.SC);
  scLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://w.soundcloud.com/player/api.js";
    s.onload = () => resolve(w.SC!);
    s.onerror = () => { scLoad = null; reject(new Error("SoundCloud API")); };
    document.head.appendChild(s);
  });
  return scLoad;
}

const NAME = "Baptiste";
const LABEL: Record<Provider, string> = { youtube: "YouTube", bandcamp: "Bandcamp", soundcloud: "SoundCloud" };
type Item = { dj: true; key: "dj" } | (LabTrack & { dj?: false });

export function DeckLab() {
  const half = Math.ceil(LAB_TRACKS.length / 2);
  const items: Item[] = [...LAB_TRACKS.slice(0, half), { dj: true, key: "dj" }, ...LAB_TRACKS.slice(half)];
  const djIndex = half;

  const [sel, setSel] = useState(djIndex);
  const [consent, setConsent] = useState<Partial<Record<Provider, boolean>>>({});
  const [ask, setAsk] = useState<{ provider: Provider; key: string } | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "error">("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<Record<string, number>>({});
  const [needTap, setNeedTap] = useState(false);
  const [errCode, setErrCode] = useState(0);
  const [mixOn, setMixOn] = useState(false);

  const yt = useRef<YTPlayer | null>(null);
  const ytBox = useRef<HTMLDivElement>(null);
  const mixFrame = useRef<HTMLIFrameElement>(null);

  const loaded = LAB_TRACKS.find((t) => t.key === loadedKey) ?? null;
  const front = items[sel];
  const cueOf = useCallback((t: LabTrack) => cues[t.key] ?? t.cue, [cues]);
  const playing = state === "playing";
  const bc = loaded?.src === "bandcamp";

  // Track laden, sobald die Einwilligung für seinen Anbieter da ist
  useEffect(() => {
    if (!loaded || !consent[loaded.src]) return;
    if (loaded.src === "bandcamp") {
      yt.current?.destroy();
      yt.current = null;
      return;
    }
    const start = cueOf(loaded);
    if (yt.current) {
      yt.current.loadVideoById({ videoId: loaded.videoId, startSeconds: start });
      return;
    }
    let gone = false;
    youtubeApi()
      .then((YT) => {
        if (gone || !ytBox.current) return;
        const mount = document.createElement("div");
        ytBox.current.replaceChildren(mount);
        yt.current = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId: loaded.videoId,
          width: "100%",
          height: "100%",
          playerVars: { start, playsinline: 1, rel: 0 },
          events: {
            onReady: (e: { target: YTPlayer }) => e.target.playVideo(),
            onStateChange: (e: { data: number }) => {
              if (e.data === 1) { setState("playing"); setNeedTap(false); }
              else if (e.data === 2 || e.data === 0) setState("paused");
            },
            onError: (e: { data: number }) => { setErrCode(e.data); setState("error"); },
          },
        });
      })
      .catch(() => setState("error"));
    return () => { gone = true; };
    // nur beim Wechsel des Tracks oder der Einwilligung neu laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey, consent.youtube, consent.bandcamp]);

  // Echte Position aus dem Player lesen
  useEffect(() => {
    const id = setInterval(() => {
      const p = yt.current;
      if (!p || bc) return;
      try {
        setTime(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [bc]);

  // Mobile Browser verlangen oft einen ersten Tipp direkt im Player
  useEffect(() => {
    if (!loaded || bc || !consent.youtube || playing) return;
    const id = setTimeout(() => setNeedTap(true), 2500);
    return () => clearTimeout(id);
  }, [loaded, bc, consent.youtube, playing]);

  // SoundCloud-Mix: nach dem Laden über die Widget-API zum Zeitstempel springen
  useEffect(() => {
    if (!mixOn || !mixFrame.current) return;
    const el = mixFrame.current;
    soundcloudApi()
      .then((SC) => {
        const w = SC.Widget(el);
        w.bind(SC.Widget.Events.READY, () => { w.seekTo(LAB_MIX.cue * 1000); w.play(); });
      })
      .catch(() => {});
  }, [mixOn]);

  const putOn = (t: LabTrack) => {
    setSel(items.findIndex((i) => i.key === t.key));
    setNeedTap(false);
    if (!consent[t.src]) { setAsk({ provider: t.src, key: t.key }); setLoadedKey(t.key); setState("idle"); return; }
    setAsk(null);
    setTime(cueOf(t));
    if (t.key === loadedKey && t.src === "youtube") { yt.current?.seekTo(cueOf(t), true); yt.current?.playVideo(); return; }
    setErrCode(0);
    setState(state === "playing" && t.src === "youtube" ? "playing" : "idle");
    setLoadedKey(t.key);
  };

  const select = (i: number) => {
    const it = items[i];
    if (playing && !it.dj && consent[it.src]) putOn(it);
    else setSel(i);
  };

  const togglePlay = () => {
    if (front.dj) {
      if (playing) { yt.current?.pauseVideo(); return; }
      const nb = items[sel + 1] && !items[sel + 1].dj ? items[sel + 1] : items[sel - 1];
      if (nb && !nb.dj) putOn(nb);
      return;
    }
    if (!loaded || (front.key !== loaded.key && !playing)) { putOn(front); return; }
    if (!consent[loaded.src]) { setAsk({ provider: loaded.src, key: loaded.key }); return; }
    if (bc) return;
    if (playing) yt.current?.pauseVideo();
    else yt.current?.playVideo();
  };

  const seek = (to: number) => { yt.current?.seekTo(to, true); setTime(to); };
  const canSeek = !!loaded && !bc && !!consent.youtube && state !== "error";
  const playLabel = !loaded || !consent[loaded.src] ? "Play the crate" : bc ? "Use the Bandcamp player below" : playing ? "Pause" : "Play";
  const discOut = !!loaded && !front.dj && front.key === loaded.key;
  const ytVisible = !!loaded && loaded.src === "youtube" && !!consent.youtube;

  return (
    <main className="flex-1 bg-day-ground text-ink">
      <header className="flex h-[72px] items-center justify-between border-b border-line px-[clamp(20px,4vw,56px)]">
        <span className="text-[30px] font-extrabold tracking-[-0.06em]">Selectorz</span>
        <span className="label-mono hidden text-ink-3 sm:inline">Lab · Deck · test page, not linked</span>
        <span className="label-mono text-ink-3 sm:hidden">Lab · Deck</span>
      </header>

      <section className="px-[clamp(20px,4vw,56px)] pt-10 text-center">
        <p className="label-mono text-ink-3">DJ · Disco House · Ruff&apos;n House · Berlin</p>
        <h1 className="mx-auto mt-3 pb-[0.06em] text-[clamp(88px,12vw,170px)] font-extrabold leading-[0.95] tracking-[-0.06em]">{NAME}</h1>
      </section>

      <div className="relative overflow-hidden">
        <div className="relative h-[440px] [perspective:1800px]" role="group" aria-label="Crate">
          {items.map((it, i) => {
            const d = i - sel;
            const ad = Math.abs(d);
            const isFront = d === 0;
            let x = 0;
            let tf = it.dj ? "translateZ(90px) scale(1.1)" : "translateZ(60px)";
            if (d !== 0) {
              const sg = d > 0 ? 1 : -1;
              x = 225 + (ad - 1) * 96 + (d > 0 && discOut ? 130 : 0);
              x *= sg;
              tf = `translate3d(0,0,${-ad * 40}px) rotateY(${-sg * 32}deg)`;
            }
            const hidden = ad > 3;
            const isLoaded = !it.dj && loadedKey === it.key && !!consent[it.src];
            return (
              <div
                key={it.key}
                className="absolute top-[50px] h-[290px] w-[290px] transition-[transform,left,opacity] duration-500 [transform-style:preserve-3d]"
                style={{ left: `calc(50% - 145px + ${x}px)`, transform: tf, zIndex: 100 - ad, opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto" }}
              >
                {isLoaded && (
                  <div
                    aria-hidden
                    className="absolute top-[10px] h-[270px] w-[270px] rounded-full transition-[left] duration-500"
                    style={{ left: isFront ? 150 : 10, transform: "translateZ(-2px)", boxShadow: playing ? "-24px 0 60px rgba(140,147,255,0.55), 24px 0 60px rgba(240,83,42,0.45)" : "none" }}
                  >
                    <div
                      data-testid="disc-spin"
                      className={`absolute inset-0 rounded-full ${playing ? "motion-safe:animate-[spin_1.8s_linear_infinite]" : ""}`}
                      style={{ background: "repeating-radial-gradient(circle, #111 0 2px, #1d1d21 2px 4px)" }}
                    >
                      <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-end justify-center rounded-full pb-3 font-mono text-[8px] tracking-[0.08em]" style={{ background: it.color, color: it.ink }}>
                        {it.title.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-label={it.dj ? `${NAME}, profile sleeve` : `${it.title} by ${it.artist}`}
                  className="absolute inset-0 overflow-hidden rounded-[3px] text-left"
                  style={
                    it.dj
                      ? { background: "#8C93FF", boxShadow: "-18px 0 46px rgba(140,147,255,0.6), 18px 0 46px rgba(240,83,42,0.5), 0 34px 70px rgba(17,17,17,0.3)" }
                      : { background: it.color, color: it.ink, boxShadow: isFront ? "0 34px 70px rgba(17,17,17,0.3)" : "0 12px 30px rgba(17,17,17,0.2)" }
                  }
                >
                  {it.dj ? (
                    <>
                      <span aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, #111 0 2px, transparent 2.4px)", backgroundSize: "8px 8px", maskImage: "radial-gradient(ellipse 45% 55% at 50% 62%, #000 60%, transparent 62%)" }} />
                      <span className="absolute left-3.5 top-3 font-mono text-[10px] tracking-[0.1em]">SELECTORZ · SIDE A</span>
                      <span className="absolute bottom-3 left-3.5 bg-ink px-2.5 py-1.5 text-[18px] font-extrabold tracking-[-0.03em] text-night-t1">{NAME}</span>
                    </>
                  ) : (
                    <span className="flex h-full flex-col justify-between p-4">
                      <span className="flex justify-between font-mono text-[10px] uppercase tracking-[0.08em]"><span>{it.label || LABEL[it.src]}</span><span>{LABEL[it.src]}</span></span>
                      <span className="text-[64px] font-extrabold leading-[0.85] tracking-[-0.06em]">{it.title.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                      <span>
                        <span className="block font-mono text-[10px] tracking-[0.1em]">{it.artist}</span>
                        <span className="line-clamp-2 text-[21px] font-extrabold leading-none tracking-[-0.035em]">{it.title}</span>
                      </span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" aria-label="Previous record" onClick={() => select(Math.max(0, sel - 1))} className="absolute left-[clamp(12px,3vw,40px)] top-[175px] z-[200] flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-field-border bg-day-ground">‹</button>
        <button type="button" aria-label="Next record" onClick={() => select(Math.min(items.length - 1, sel + 1))} className="absolute right-[clamp(12px,3vw,40px)] top-[175px] z-[200] flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-field-border bg-day-ground">›</button>
      </div>

      <section className="flex flex-col items-center gap-3 px-[clamp(20px,4vw,56px)] pb-16 text-center">
        <p className="h-[36px] max-w-[620px] truncate text-[26px] font-extrabold leading-[1.3] tracking-[-0.04em]">
          {loaded ? `${loaded.title} · ${loaded.artist}` : front.dj ? NAME : `${front.title} · ${front.artist}`}
        </p>
        <div className="flex min-h-8 flex-wrap items-center justify-center gap-3">
          <span className="font-mono text-[12px] tracking-[0.08em] text-ink-3">
            {loaded && consent[loaded.src] ? (bc ? "TIME IN THE BANDCAMP PLAYER" : `${mmss(time)} / ${duration ? mmss(duration) : "–:–"}`) : ""}
          </span>
          {canSeek && loaded && (
            <>
              <button type="button" onClick={() => seek(cueOf(loaded))} aria-label={`Jump to cue ${mmss(cueOf(loaded))}`} className="min-h-8 rounded-full border-[1.5px] border-ink px-3 font-mono text-[10px] tracking-[0.1em]">
                ▸ CUE {mmss(cueOf(loaded))}{cues[loaded.key] === undefined && loaded.cueNote ? ` · ${loaded.cueNote.toUpperCase()}` : ""}
              </button>
              <button type="button" onClick={() => setCues((c) => ({ ...c, [loaded.key]: Math.floor(time) }))} className="min-h-8 rounded-full border-[1.5px] border-field-border px-3 font-mono text-[10px] tracking-[0.1em]">
                SET CUE HERE
              </button>
            </>
          )}
        </div>
        {canSeek && (
          <label className="flex w-full max-w-[460px] items-center gap-2.5 font-mono text-[10px] tracking-[0.1em] text-ink-3">
            <span>0:00</span>
            <input type="range" min={0} max={Math.max(1, Math.floor(duration))} value={Math.floor(time)} onChange={(e) => seek(Number(e.target.value))} aria-label="Position in the track" className="h-7 flex-1 accent-ink" />
            <span>{duration ? mmss(duration) : "–:–"}</span>
          </label>
        )}

        {ask && !consent[ask.provider] ? (
          <>
            <p className="max-w-[440px] text-[14px] leading-[1.4] text-ink-3">
              This loads the {LABEL[ask.provider]} player. {LABEL[ask.provider]} may set cookies and receives your IP address. Nothing loads before you allow it.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => { setConsent((c) => ({ ...c, [ask.provider]: true })); setAsk(null); if (loaded) setTime(cueOf(loaded)); }} className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-semibold text-day-ground shadow-[var(--shadow-cta)]">
                Allow and load the player
              </button>
              <button type="button" onClick={() => { setAsk(null); setLoadedKey(null); }} className="min-h-12 rounded-full border-[1.5px] border-ink px-[18px] text-[15px] font-semibold">Not now</button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-1 flex items-center justify-center gap-[18px]">
              <button type="button" onClick={() => seek(seekTarget(time, -15, duration))} disabled={!canSeek} aria-label="Back 15 seconds" className="h-12 w-12 rounded-full border-[1.5px] border-ink font-mono text-[11px] disabled:opacity-35">−15</button>
              <button type="button" onClick={togglePlay} disabled={bc && !!consent.bandcamp} aria-label={playLabel} className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink text-day-ground shadow-[var(--shadow-cta)] disabled:opacity-50">
                {playing ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 4l13 8-13 8z" /></svg>
                )}
              </button>
              <button type="button" onClick={() => seek(seekTarget(time, 30, duration))} disabled={!canSeek} aria-label="Forward 30 seconds" className="h-12 w-12 rounded-full border-[1.5px] border-ink font-mono text-[11px] disabled:opacity-35">+30</button>
            </div>
            <span className="label-mono text-ink-3">{playLabel}</span>
          </>
        )}

        {needTap && <p className="text-[13px] text-ink-3">Nothing playing? Tap play once inside the YouTube player. Some phones need that first tap.</p>}

        {ytVisible && (
          <div className="mt-2 flex w-full max-w-[680px] flex-wrap items-center gap-4 rounded-[18px] bg-surface p-3.5 text-left shadow-[var(--shadow-card)]">
            <div ref={ytBox} className="h-[200px] w-[356px] max-w-full flex-none overflow-hidden rounded-[8px] bg-ink" />
            <DeckText kicker="Playing via YouTube" href={loaded!.url} link="Open on YouTube ↗">
              {state === "error"
                ? errCode === 101 || errCode === 150
                  ? "The uploader doesn't allow this video on other sites. Listen on YouTube instead."
                  : errCode === 100
                    ? "This video is gone from YouTube."
                    : "Your browser couldn't play this video here. Try again, or listen on YouTube."
                : `The official player stays visible. Selectorz only starts, pauses and jumps to the cue. Upload by ${loaded!.uploader}. Ads, if any, come from YouTube.`}
            </DeckText>
          </div>
        )}
        {bc && consent.bandcamp && (
          <div className="mt-2 flex w-full max-w-[680px] flex-col gap-3 rounded-[18px] bg-surface p-3.5 text-left shadow-[var(--shadow-card)]">
            <iframe title={`Bandcamp player: ${loaded!.title}`} src={bandcampEmbedSrc((loaded as Extract<LabTrack, { src: "bandcamp" }>).albumId)!} className="h-[120px] w-full rounded-[8px] border-0" seamless />
            <DeckText kicker="Playing via Bandcamp" href={loaded!.url} link="Listen and buy on Bandcamp ↗">
              Bandcamp can&apos;t be started or skipped from here. Use its own play button. Selectorz only shows the record.
            </DeckText>
          </div>
        )}
      </section>

      <section className="border-t border-line px-[clamp(20px,4vw,56px)] py-12">
        <div className="mx-auto flex max-w-[680px] flex-col gap-3">
          <p className="label-mono text-ink-3">Latest mix · SoundCloud widget test (sample, in the product only own uploads)</p>
          <p className="text-[26px] font-extrabold leading-none tracking-[-0.035em]">{LAB_MIX.title}</p>
          <p className="text-[14px] text-ink-2">{LAB_MIX.by}</p>
          {mixOn ? (
            <iframe ref={mixFrame} title={`SoundCloud player: ${LAB_MIX.title}`} src={soundcloudWidgetSrc(LAB_MIX.url)!} allow="autoplay" className="h-[166px] w-full border-0" />
          ) : consent.soundcloud ? (
            <button type="button" onClick={() => setMixOn(true)} className="min-h-12 self-start rounded-full bg-ink px-5 text-[15px] font-semibold text-day-ground">Play from {mmss(LAB_MIX.cue)}</button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => { setConsent((c) => ({ ...c, soundcloud: true })); setMixOn(true); }} className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-semibold text-day-ground">
                Allow SoundCloud and play from {mmss(LAB_MIX.cue)}
              </button>
              <span className="text-[13px] text-ink-3">Loads the SoundCloud player. SoundCloud may set cookies.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function DeckText({ kicker, href, link, children }: { kicker: string; href: string; link: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
      <span className="label-mono text-ink-3">{kicker}</span>
      <p className="text-[15px] leading-[1.4] text-ink-2">{children}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold underline-offset-4 hover:underline">{link}</a>
    </div>
  );
}
