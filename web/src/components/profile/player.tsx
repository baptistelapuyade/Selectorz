"use client";

import { createContext, useContext, useState } from "react";
import { embedSrc, providerOf, PROVIDER_LABEL } from "@/lib/profile";
import { track } from "@/components/analytics";

// Immer nur ein Player gleichzeitig (MEDIA-09). Geladen wird erst nach Tippen (MEDIA-07).
const Ctx = createContext<{ active: string | null; setActive: (id: string | null) => void }>({ active: null, setActive: () => {} });

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  return <Ctx.Provider value={{ active, setActive }}>{children}</Ctx.Provider>;
}

const PlayIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
);

// Großer Play-Knopf + darunterliegende Fläche für das offizielle Widget
export function PlayerCard({
  id, url, title, sub, accent, onAccent, surface, line, muted, startSeconds = 0, big = false,
}: {
  id: string; url: string; title: string; sub?: string; accent: string; onAccent: string; surface: string; line: string; muted: string;
  startSeconds?: number; big?: boolean;
}) {
  const { active, setActive } = useContext(Ctx);
  const provider = providerOf(url);
  const src = embedSrc(url, startSeconds);
  const playing = active === id && src;
  return (
    <div className="flex flex-col rounded-[6px] border" style={{ background: surface, borderColor: line }}>
      <div className="flex items-center gap-3 p-3.5 md:gap-4 md:p-[18px]">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`${big ? "text-[28px] md:text-[34px]" : "text-[24px] md:text-[28px]"} line-clamp-2 font-extrabold leading-[0.95] tracking-[-0.035em]`}>{title}</span>
          {sub && <span className="truncate text-[13px] md:text-[14px]" style={{ color: muted }}>{sub}</span>}
        </div>
        {src ? (
          <button
            type="button"
            aria-label={playing ? `Stop ${title}` : `Load player and play ${title}`}
            onClick={() => {
              setActive(playing ? null : id);
              if (!playing) track("media_opened", { provider });
            }}
            className="grow flex h-12 w-12 flex-none items-center justify-center rounded-full md:h-14 md:w-14"
            style={{ background: accent, color: onAccent }}
          >
            {playing ? <span className="text-[14px] font-bold">❚❚</span> : <PlayIcon />}
          </button>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="nudge grow flex h-12 flex-none items-center gap-1 rounded-full px-4 text-[14px] font-semibold" style={{ background: accent, color: onAccent }}>
            Open <span aria-hidden className="nudge-arrow">↗</span>
          </a>
        )}
      </div>
      {playing ? (
        <iframe
          title={`${PROVIDER_LABEL[provider]} player: ${title}`}
          src={src}
          allow="autoplay; encrypted-media"
          className="h-[166px] w-full border-t"
          style={{ borderColor: line }}
        />
      ) : (
        src && (
          <p className="border-t px-3.5 py-2.5 font-mono text-[10px] tracking-[0.06em]" style={{ borderColor: line, color: muted }}>
            TAP TO LOAD THE {PROVIDER_LABEL[provider].toUpperCase()} PLAYER · DATA GOES TO {PROVIDER_LABEL[provider].toUpperCase()}
          </p>
        )
      )}
    </div>
  );
}

// Zeile in einer Track-Liste: Play-Kreis inline, Pfeil öffnet die Plattform
export function TrackRow({
  id, url, title, artist, fg, muted, line, first,
}: { id: string; url: string; title: string; artist?: string; fg: string; muted: string; line: string; first: boolean }) {
  const { active, setActive } = useContext(Ctx);
  const provider = providerOf(url);
  const src = embedSrc(url);
  const playing = active === id && src;
  return (
    <li className="row-hover" style={{ borderTop: first ? "0" : `1px solid ${line}` }}>
      <div className="flex min-h-16 items-center gap-3 py-2 pl-3 pr-1">
        <button
          type="button"
          disabled={!src}
          aria-label={src ? `Play ${title}` : `${title} can't play here`}
          onClick={() => {
            setActive(playing ? null : id);
            if (!playing) track("media_opened", { provider });
          }}
          className="tint flex h-9 w-9 flex-none items-center justify-center rounded-full border-[1.5px] disabled:opacity-30"
          style={{ borderColor: fg, color: fg }}
        >
          {playing ? <span className="text-[10px] font-bold">❚❚</span> : <PlayIcon size={11} />}
        </button>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-[16px] font-semibold tracking-[-0.01em]">{title}</span>
          <span className="truncate text-[12px]" style={{ color: muted }}>
            {[artist, PROVIDER_LABEL[provider]].filter(Boolean).join(" · ")}
          </span>
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} on ${PROVIDER_LABEL[provider]}`} className="nudge flex h-11 w-11 flex-none items-center justify-center">
          <svg className="nudge-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>
        </a>
      </div>
      {playing && <iframe title={`Player: ${title}`} src={src!} allow="autoplay; encrypted-media" className="h-[166px] w-full" />}
    </li>
  );
}
