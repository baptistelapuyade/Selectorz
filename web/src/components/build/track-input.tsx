"use client";

import { useState, useTransition } from "react";
import { resolveLink } from "@/app/(build)/start/actions";
import type { DraftTrack } from "@/lib/build/draft";
import { PROVIDER_LABEL } from "@/lib/profile";

type Props = {
  label: string;               // sichtbares/zugängliches Label des Link-Felds
  placeholder: string;
  track: DraftTrack | null;
  onChange: (t: DraftTrack | null, meta?: { artist: string }) => void;
  manualSuffix?: string;       // „ of track 2“ für eindeutige Labels
  big?: boolean;
};

// Link einfügen → offizielle Metadaten holen → gefunden, oder Titel und Artist von Hand (MEDIA-01, A5).
export function TrackInput({ label, placeholder, track, onChange, manualSuffix = "", big }: Props) {
  const [value, setValue] = useState(track?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = label.replace(/\W+/g, "-").toLowerCase();

  const resolve = (raw: string) => {
    const v = raw.trim();
    if (!v || v === track?.url) return;
    start(async () => {
      const r = await resolveLink(v);
      if (!r.ok) {
        setError(r.error);
        onChange(null);
        return;
      }
      setError(null);
      setValue(r.url);
      onChange(
        { url: r.url, provider: r.provider, title: r.meta?.title ?? "", artist: r.meta?.artist ?? "", fetched: r.meta ? "ok" : "failed" },
        r.meta ? { artist: r.meta.artist } : undefined,
      );
    });
  };

  const found = track && track.fetched === "ok";
  const manual = track && track.fetched === "failed";
  const canFetch = track && ["soundcloud", "youtube", "mixcloud"].includes(track.provider);

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span
        className={`flex items-center gap-2.5 rounded-full bg-surface pl-4 shadow-[0_0_0_2px_#111111] md:pl-5 ${big ? "h-14 pr-1.5 md:h-[68px] md:pr-2" : "h-[60px] pr-2"}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="hidden flex-none md:block">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
        <input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => resolve(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text) setTimeout(() => resolve(text), 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              resolve(value);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-4 md:text-[18px]"
        />
        {(pending || track) && (
          <span className={`flex flex-none items-center gap-2 rounded-full bg-bg px-3 text-[13px] font-semibold md:px-4 md:text-[14px] ${big ? "h-11 md:h-[52px]" : "h-11"}`} aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${pending ? "animate-pulse bg-ink-4" : found ? "bg-ok" : "bg-orange"}`} />
            {pending ? "Checking" : found ? "Found" : "Add details"}
          </span>
        )}
      </span>

      {error && <p key={error} role="alert" className="shake text-[13px] text-error-text">{error}</p>}

      {found && (
        <span className="appear flex items-center gap-3 rounded-s border border-line bg-surface px-3.5 py-3">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ok text-white" aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="line-clamp-2 text-[15px] font-semibold">{track.title}</span>
            <span className="truncate text-[12px] text-ink-3">Found on {PROVIDER_LABEL[track.provider]}{track.artist ? ` · ${track.artist}` : ""}</span>
          </span>
          <button
            type="button"
            aria-label={`Remove ${track.title}`}
            onClick={() => {
              setValue("");
              onChange(null);
            }}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[20px] text-ink-3 hover:bg-bg"
          >
            ×
          </button>
        </span>
      )}

      {manual && (
        <div className="appear flex flex-col gap-2.5 rounded-s border border-line bg-surface p-3.5">
          <p className="text-[13px] leading-[1.4] text-ink-2">
            {canFetch ? "We couldn't read that link. Add the title yourself, the link stays." : "Add title and artist yourself. The link stays."}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              {`Title${manualSuffix}`}
              <input
                value={track.title}
                maxLength={200}
                onChange={(e) => onChange({ ...track, title: e.target.value })}
                className="field h-11 rounded-s border border-field-border bg-surface px-3 text-[16px] font-normal outline-none focus:border-2 focus:border-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              {`Artist${manualSuffix}`}
              <input
                value={track.artist ?? ""}
                maxLength={200}
                onChange={(e) => onChange({ ...track, artist: e.target.value })}
                className="field h-11 rounded-s border border-field-border bg-surface px-3 text-[16px] font-normal outline-none focus:border-2 focus:border-ink"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorksWith() {
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2 md:text-[13px]">
        <span className="mr-1">Works with</span>
        <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-ink px-2.5 font-semibold text-night-t1 md:h-7">
          SoundCloud <span className="font-mono text-[8px] font-medium tracking-[0.08em] text-chip-border md:text-[9px]">BEST</span>
        </span>
        {["YouTube", "Bandcamp", "Mixcloud"].map((p) => (
          <span key={p} className="inline-flex h-[26px] items-center rounded-full border border-chip-border bg-surface-sunken px-2.5 font-semibold md:h-7">{p}</span>
        ))}
      </span>
      <span className="text-[12px] leading-[1.35] text-ink-3">Other links work too. You add title and artist yourself.</span>
    </span>
  );
}
