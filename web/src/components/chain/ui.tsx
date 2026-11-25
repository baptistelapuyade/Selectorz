"use client";

import Link from "next/link";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { TrackInput, WorksWith } from "@/components/build/track-input";
import { track as log } from "@/components/analytics";
import { firstName, ROLE_COLOR, urlKey as urlKeyOf, type Entry, type PageTrack, type Role } from "@/lib/chains";
import type { DraftTrack } from "@/lib/build/draft";
import { embedSrc, providerOf, PROVIDER_LABEL } from "@/lib/profile";
import { copyText } from "@/lib/copy";

// Kopf der Kettenseiten (Boards DeskChain*3): Logo, „A × B“ mit Personenfarben, rechts der Stand
export function ChainHeader({ a, b, right }: { a: string; b: string | null; right: string }) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-line px-4 md:h-[72px] md:px-10">
      <Link href="/home" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[26px] md:tracking-[-0.045em]">Selectorz</Link>
      <span className="label-mono mx-auto hidden items-center gap-2 text-ink-2 sm:flex" aria-hidden>
        <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR.A }} />
        {firstName(a).toUpperCase()} × {b ? firstName(b).toUpperCase() : "?"}
        <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR.B }} />
      </span>
      <span className="label-mono ml-auto text-ink-3 sm:ml-0">{right}</span>
    </header>
  );
}

// Untere Leiste mit Hinweis links und Hauptknopf rechts
export function Bar({ note, children }: { note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-bg">
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-20 md:py-5">
        {note ? <span className="text-[13px] leading-[1.4] text-ink-2 md:text-[15px]">{note}</span> : <span />}
        <span className="flex flex-col gap-2 md:flex-row md:items-center">{children}</span>
      </div>
    </div>
  );
}

export function Cta({ children, onClick, disabled, href, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; href?: string; type?: "button" | "submit" }) {
  const cls = "cta flex h-[58px] items-center justify-between gap-7 rounded-full bg-ink px-7 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none";
  if (href) return <Link href={href} className={cls}>{children} <span aria-hidden className="cta-arrow">→</span></Link>;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      <span>{children}</span>
      <span aria-hidden className="cta-arrow">→</span>
    </button>
  );
}

export const Num = ({ n, role, open, color }: { n: number; role?: Role; open?: boolean; color?: string }) => {
  const c = role ? (color ?? ROLE_COLOR[role]) : undefined;
  return (
    <span
      className={`flex h-[26px] w-10 flex-none items-center justify-center rounded-full font-mono text-[11px] font-semibold ${open ? "border border-dashed" : role ? "text-ink" : "border border-night-line text-night-t3"}`}
      style={c ? (open ? { borderColor: c, color: c } : { background: c }) : undefined}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
};

// Ein Player zur Zeit (MEDIA-09), geladen erst nach Tippen (MEDIA-07)
const Play = createContext<{ on: string | null; set: (id: string | null) => void }>({ on: null, set: () => {} });
export function PlayProvider({ children }: { children: React.ReactNode }) {
  const [on, set] = useState<string | null>(null);
  return <Play.Provider value={{ on, set }}>{children}</Play.Provider>;
}
export function usePlay(id: string, url: string) {
  const { on, set } = useContext(Play);
  const src = embedSrc(url);
  const playing = on === id && !!src;
  return {
    src,
    playing,
    toggle: () => {
      set(playing ? null : id);
      if (!playing) log("media_opened", { provider: providerOf(url) });
    },
  };
}

export function PlayButton({ id, url, title, big, dark }: { id: string; url: string; title: string; big?: boolean; dark?: boolean }) {
  const { src, playing, toggle } = usePlay(id, url);
  const size = big ? "h-12 w-12 md:h-14 md:w-14" : "h-10 w-10";
  if (!src)
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} on ${PROVIDER_LABEL[providerOf(url)]}`}
        className={`flex ${size} flex-none items-center justify-center rounded-full border-[1.5px] ${dark ? "border-night-t1" : "border-ink"}`}>
        ↗
      </a>
    );
  return (
    <button type="button" onClick={toggle} aria-label={playing ? `Stop ${title}` : `Play ${title}`}
      className={`pop flex ${size} flex-none items-center justify-center rounded-full ${big ? "bg-orange text-ink" : `border-[1.5px] ${dark ? "border-night-t1" : "border-ink"}`}`}>
      {playing ? <span className="text-[11px] font-bold">❚❚</span> : <svg width={big ? 14 : 11} height={big ? 14 : 11} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>}
    </button>
  );
}

export function PlayFrame({ id, url, title }: { id: string; url: string; title: string }) {
  const { src, playing } = usePlay(id, url);
  if (!playing || !src) return null;
  return <iframe title={`${PROVIDER_LABEL[providerOf(url)]} player: ${title}`} src={src} allow="autoplay; encrypted-media" className="mt-3 h-[166px] w-full rounded-[10px]" />;
}

// Der zuletzt gespielte Track der anderen Person, groß und spielbar (Board „Your turn“)
export function LastPlayed({ e, who }: { e: Entry; who: string }) {
  const id = `e${e.position}`;
  return (
    <section className="rounded-[18px] bg-night-bg p-5 text-night-t1 md:px-[60px] md:py-6" aria-label={`${who} played`}>
      <div className="relative flex items-center gap-4">
        <span className="md:absolute md:-left-[46px]"><Num n={e.position} role={e.role} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="label-mono text-night-t3">{who.toUpperCase()} PLAYED</span>
          <span className="text-[22px] font-extrabold leading-tight tracking-[-0.035em] md:text-[24px] [overflow-wrap:anywhere]">{e.title}{e.artist ? ` · ${e.artist}` : ""}</span>
          {e.comment && <span className="text-[15px] italic text-night-t2">“{e.comment}”</span>}
        </span>
        <PlayButton id={id} url={e.url} title={e.title} big dark />
      </div>
      <PlayFrame id={id} url={e.url} title={e.title} />
    </section>
  );
}

// Die Kette rechts: gespielte Tracks, der eigene offene Platz, die kommenden Plätze
export function ChainList({ title, entries, target, names, mine, pick, colors }: {
  title: string; entries: Entry[]; target: number; names: Record<Role, string>; mine: Role; pick: number | null; colors?: Record<Role, string>;
}) {
  const roleAt = (pos: number): Role => (pos % 2 === 1 ? "A" : "B");
  return (
    <section className="flex flex-col rounded-[22px] bg-night-bg p-5 text-night-t1 md:p-7" aria-label="The chain">
      <span className="flex items-baseline justify-between pb-4">
        <span className="text-[26px] font-extrabold tracking-[-0.045em] md:text-[30px] [overflow-wrap:anywhere]">{title}</span>
        <span className="label-mono flex-none text-night-t3">{entries.length} OF {target}</span>
      </span>
      <ol className="flex flex-col">
        {Array.from({ length: target }, (_, i) => {
          const pos = i + 1;
          const e = entries.find((x) => x.position === pos);
          if (e)
            return (
              <li key={pos} className="border-t border-night-line py-3.5" data-testid={`entry-${pos}`}>
                <span className="flex items-center gap-3">
                  <Num n={pos} role={e.role} color={colors?.[e.role]} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[16px] [overflow-wrap:anywhere]"><b className="font-semibold">{e.title}</b>{e.artist && <span className="text-night-t2"> · {e.artist}</span>}</span>
                    {e.comment && <span className="text-[14px] italic text-night-t2">“{e.comment}”</span>}
                  </span>
                  <span className="label-mono hidden text-night-t3 sm:block">{e.role === mine ? "YOU" : firstName(names[e.role]).toUpperCase()}</span>
                  <PlayButton id={`e${pos}`} url={e.url} title={e.title} dark />
                </span>
                <PlayFrame id={`e${pos}`} url={e.url} title={e.title} />
              </li>
            );
          const r = roleAt(pos);
          const you = pos === pick;
          return (
            <li key={pos} className="flex items-center gap-3 border-t border-night-line py-3.5">
              <Num n={pos} role={you ? r : undefined} open={you} />
              <span className={you ? "text-[16px] font-semibold" : "text-[15px] text-night-t3"} style={you ? { color: ROLE_COLOR[r] } : undefined}>
                {you ? "You pick this one" : r === mine ? "Your pick" : names[r] ? `${firstName(names[r])}’s pick` : "Your guest’s pick"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="pt-3 text-[13px] text-night-t3">One player at a time. Players load only when you tap play.</p>
    </section>
  );
}

// Fortschritt in sechs Balken (Board „Invite“): Personenfarben für gespielte Plätze
export function Progress({ entries, target }: { entries: { role: Role }[]; target: number }) {
  return (
    <span className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${target}, minmax(0,1fr))` }} aria-hidden>
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className="h-2 rounded-full" style={{ background: entries[i] ? ROLE_COLOR[entries[i].role] : "#D6D6D1" }} />
      ))}
    </span>
  );
}

// Teilen-Knöpfe wie im Board (DeskChainStart3, NOTIFY-08): WhatsApp, Instagram, Telegram, More…
// Instagram hat keinen Web-Teilen-Link: Link wird kopiert, Hinweis zum Einfügen in eine DM.
export function ShareChips({ url, text, disabled }: { url: string | null; text: string; disabled?: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noop, () => typeof navigator !== "undefined" && !!navigator.share, () => false);
  const chip = "flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold disabled:opacity-40 hover:border-ink";
  const dot = (c: string) => <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c }} />;
  const msg = url ? `${text} ${url}` : "";
  const off = disabled || !url;
  return (
    <span className="flex flex-col gap-2">
      <span className="flex flex-wrap gap-2">
        <a aria-disabled={off} href={off ? undefined : `https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
          className={`${chip} ${off ? "pointer-events-none opacity-40" : ""}`}>{dot("#25D366")}WhatsApp</a>
        <button type="button" disabled={off} className={chip}
          onClick={async () => {
            try {
              if (!(await copyText(url!))) throw new Error("copy");
              setNote("Link copied. Paste it into an Instagram DM.");
            } catch {
              setNote("Copy the link above and paste it into an Instagram DM.");
            }
          }}>{dot("#D6249F")}Instagram</button>
        <a aria-disabled={off} href={off ? undefined : `https://t.me/share/url?url=${encodeURIComponent(url ?? "")}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
          className={`${chip} ${off ? "pointer-events-none opacity-40" : ""}`}>{dot("#2AABEE")}Telegram</a>
        {canShare && (
          <button type="button" disabled={off} className={chip} onClick={() => navigator.share({ text, url: url! }).catch(() => {})}>More…</button>
        )}
      </span>
      {note && <span role="status" className="text-[13px] text-ok">{note}</span>}
    </span>
  );
}

// Einladungslink (Board DeskChainStart3): weiße Karte, Link kopieren, teilen, Fortschritt; ersetzen, abschalten.
// pending: Track 1 ist noch nicht gespeichert, die Karte zeigt schon, was kommt.
export function InviteCard({ url, onRenew, onRevoke, busy, title = "Who plays track 2?", pending, entries = [{ role: "A" }] }: {
  url: string | null; onRenew?: () => void; onRevoke?: () => void; busy: boolean; title?: string; pending?: boolean; entries?: { role: Role }[];
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!url) return;
    try {
      if (!(await copyText(url))) throw new Error("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Feld ist markierbar */
    }
  };
  return (
    <section className="flex flex-col gap-5 rounded-[22px] bg-surface p-5 shadow-[0_1px_2px_rgba(17,17,17,0.06),0_24px_60px_rgba(17,17,17,0.08)] md:p-8" aria-labelledby="invite-title">
      <span className="flex items-center gap-3">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink font-mono text-[12px] font-semibold text-night-t1">2</span>
        <span className="text-[20px] font-semibold tracking-[-0.02em]">Invite one DJ</span>
      </span>
      <h2 id="invite-title" className="text-[32px] font-extrabold leading-[0.92] tracking-[-0.045em] md:text-[40px]">{title}</h2>
      {url || pending ? (
        <>
          <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input readOnly value={url ?? ""} placeholder="Your link appears here" aria-label="Your invite link" onFocus={(e) => e.target.select()}
              className="h-14 min-w-0 flex-1 rounded-s border border-[#F4F4F1] bg-[#F4F4F1] px-4 text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-3" />
            <button type="button" onClick={copy} disabled={!url} className="cta h-14 flex-none rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none">
              {copied ? "Copied" : "Copy link"}
            </button>
          </span>
          <ShareChips url={url} text="Play the next track with me on Selectorz:" />
          <p className="text-[14px] leading-[1.45] text-ink-2">
            {pending && !url ? "Save track 1 and your link is ready. " : ""}Send it to one person. The first DJ who joins gets the spot. We don’t email people who aren’t on Selectorz yet.
          </p>
        </>
      ) : (
        <p className="text-[14px] leading-[1.45] text-ink-2">
          For safety we only show an invite link once. Lost it? Make a new one. The old link stops working.
        </p>
      )}
      <span className="flex flex-col gap-2.5 border-t border-[#E2E2DE] pt-4">
        <span className="flex justify-between"><span className="label-mono text-ink-3">THE CHAIN</span><span className="label-mono text-ink-3">{pending && !url ? 0 : entries.length} OF 6</span></span>
        <span className="grid grid-cols-6 gap-1.5" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => {
            const done = !(pending && !url) && entries[i];
            const next = i === (pending && !url ? 0 : entries.length);
            const role: Role = i % 2 ? "B" : "A";
            return <span key={i} className={`h-2 rounded-full ${next ? "ping" : ""}`} style={{ background: done ? ROLE_COLOR[done.role] : next ? ROLE_COLOR[role] : "rgba(17,17,17,0.18)" }} />;
          })}
        </span>
      </span>
      {!pending && (onRenew || onRevoke) && (
        <span className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          {onRenew && (
            <button type="button" disabled={busy} onClick={onRenew} className="link-hover font-semibold underline underline-offset-4 disabled:opacity-50">
              Make a new link
            </button>
          )}
          {url && onRevoke && (
            <button type="button" disabled={busy} onClick={onRevoke} className="link-hover font-semibold text-ink-2 underline underline-offset-4 disabled:opacity-50">
              Turn off this link
            </button>
          )}
        </span>
      )}
    </section>
  );
}

export type Pick = { track: DraftTrack | null; comment: string };

// Track wählen: Link einfügen oder von der eigenen Seite; dazu „Why this one?“ (CHAIN-05, CHAIN-06)
export function TrackPick({ value, onChange, page, n, taken }: {
  value: Pick; onChange: (p: Pick) => void; page: PageTrack[]; n: number; taken: string[];
}) {
  const [tab, setTab] = useState<"link" | "page">("link");
  const [key, setKey] = useState(0); // TrackInput neu aufsetzen, wenn von der Seite gewählt wird
  const dup = value.track && taken.includes(urlKeyOf(value.track.url));
  return (
    <div className="flex flex-col gap-4">
      {page.length > 0 && (
        <span role="tablist" className="flex self-start rounded-full bg-line-soft p-1">
          {(["link", "page"] as const).map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`h-10 rounded-full px-4 text-[15px] font-semibold ${tab === t ? "bg-ink text-night-t1" : ""}`}>
              {t === "link" ? "Paste a link" : <>From your page <span className="font-mono text-[10px] text-ink-3">{page.length}</span></>}
            </button>
          ))}
        </span>
      )}
      {tab === "page" ? (
        <ul className="flex flex-col rounded-[14px] border border-line bg-surface" aria-label="Tracks from your page">
          {page.map((t, i) => {
            const on = value.track?.url === t.url;
            const used = taken.includes(urlKeyOf(t.url));
            return (
              <li key={t.url} className={i ? "border-t border-line" : ""}>
                <button type="button" disabled={used} aria-pressed={on}
                  onClick={() => {
                    onChange({ ...value, track: { url: t.url, title: t.title, artist: t.artist, provider: providerOf(t.url), fetched: "ok" } });
                    setKey((k) => k + 1);
                    setTab("link");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg disabled:opacity-40">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{t.title}</span>
                    <span className="truncate text-[12px] text-ink-3">{[t.artist, PROVIDER_LABEL[providerOf(t.url)]].filter(Boolean).join(" · ")}{used ? " · already in this round" : ""}</span>
                  </span>
                  <span className="text-[13px] font-semibold">{on ? "Picked" : "Pick"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-[14px] font-semibold">Track link</span>
          <TrackInput key={key} label={`Link of track ${n}`} placeholder="Paste a track link" track={value.track} onChange={(t) => onChange({ ...value, track: t })} />
          {!value.track && <WorksWith />}
        </div>
      )}
      {dup && <p role="alert" className="text-[13px] text-error-text">That track is already in this round. Pick another one.</p>}
      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        <span>Why this one? <span className="font-normal text-ink-3">Optional</span></span>
        <input value={value.comment} maxLength={140} onChange={(e) => onChange({ ...value, comment: e.target.value })}
          className="field h-14 rounded-s border border-field-border bg-surface px-4 text-[16px] font-normal outline-none focus:border-2 focus:border-ink" />
        <span className="self-end font-mono text-[11px] font-normal text-ink-3">{value.comment.length}/140</span>
      </label>
    </div>
  );
}

export const pickReady = (p: Pick, taken: string[]) => !!p.track && !!p.track.title.trim() && !taken.includes(urlKeyOf(p.track.url));

const noop = () => () => {};
