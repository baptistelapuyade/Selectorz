"use client";

import { useState } from "react";
import { GenreSheet } from "@/components/build/genre-sheet";
import { ACCENTS, DEFAULT_ACCENT, isAccent } from "@/lib/accents";
import { PLAYS } from "@/lib/build/genres";
import { BIO_MAX, type EditDraft } from "@/lib/edit/model";
import { lookTokens, photoUrl } from "@/lib/profile";
import { Panel } from "./panel";

type Props = { d: EditDraft; handle: string; set: (patch: Partial<EditDraft>) => void; onPhoto: () => void; onClose: () => void };

// Grunddaten (M1cBasics): Foto, Name, feste Adresse, Sound, Based, Plays, About you, Look, Akzentfarbe.
export function BasicsPanel({ d, handle, set, onPhoto, onClose }: Props) {
  const [genreOpen, setGenreOpen] = useState(false);
  const t = lookTokens(d.look, d.accent);
  const src = photoUrl(d.photo_path, d.look, d.photo_style);
  return (
    <Panel title="Your basics" onClose={onClose}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onPhoto}
          aria-label="Change photo"
          className={`relative aspect-[4/5] w-[72px] flex-none overflow-hidden rounded-[6px] ${d.photo_path ? "" : "need"}`}
          style={{ background: t.htBg }}
        >
          {src && d.photo_style === "bw" ? (
            // eslint-disable-next-line @next/next/no-img-element -- fertiges Bild aus dem Speicher
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : src ? (
            <span className="absolute inset-0" style={{ background: t.htDot, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "cover", maskSize: "cover" }} />
          ) : (
            <span className="text-[11px] font-semibold">+ Photo</span>
          )}
        </button>
        <span className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">
            Photo <span className="font-normal text-ink-3">· {d.photo_style === "bw" ? "Black and white" : "Dot matrix"}</span>
          </span>
          <button type="button" onClick={onPhoto} className="h-9 self-start rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-semibold hover:bg-ink hover:text-night-t1">
            Change photo
          </button>
        </span>
      </div>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        DJ name
        <input
          value={d.display_name}
          maxLength={60}
          onChange={(e) => set({ display_name: e.target.value })}
          className={`field h-12 rounded-s border border-field-border bg-surface px-3.5 text-[16px] font-normal outline-none focus:border-2 focus:border-ink ${d.display_name.trim() ? "" : "need"}`}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold">Page address</span>
        <span className="flex h-12 items-center rounded-s bg-line-soft px-3.5 text-[16px] text-ink-2">selectorz.art/{handle}</span>
        <span className="text-[12px] text-ink-3">Your address stays the same once you&apos;re live, so links you shared keep working.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold">
          Sound <span className="font-normal text-ink-3">· required, up to 3</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {d.genres.map((g) => (
            <span key={g} className="flex h-9 items-center rounded-full bg-ink px-3.5 text-[13px] font-semibold text-night-t1">{g}</span>
          ))}
          <button type="button" onClick={() => setGenreOpen(true)} className={`link-hover h-9 px-2 text-[13px] font-semibold underline underline-offset-4 ${d.genres.length ? "" : "need"}`}>
            {d.genres.length ? "Change" : "+ Add your sound"}
          </button>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          <span>Based <span className="text-[12px] font-normal text-ink-3">optional</span></span>
          <input
            value={d.city}
            maxLength={60}
            onChange={(e) => set({ city: e.target.value })}
            className="field h-11 rounded-s border border-field-border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Plays <span className="text-[12px] font-normal text-ink-3">optional, up to 3</span></span>
          <span className="flex flex-wrap gap-1.5">
            {PLAYS.map((p) => {
              const on = d.plays.includes(p);
              return (
                <label key={p} className={`flex h-8 cursor-pointer items-center rounded-full px-3 text-[12px] font-semibold ${on ? "bg-ink text-night-t1" : "chip border-[1.2px] border-chip-border"}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ plays: on ? d.plays.filter((x) => x !== p) : [...d.plays, p].slice(0, 3) })} />
                  {p}
                </label>
              );
            })}
          </span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
        <span className="flex justify-between">
          About you <span className="text-[12px] font-normal text-ink-3">optional · {d.bio.length} of {BIO_MAX}</span>
        </span>
        <textarea
          rows={2}
          value={d.bio}
          maxLength={BIO_MAX}
          placeholder="Resident at … Sundays, slow and warm."
          onChange={(e) => set({ bio: e.target.value })}
          className="field resize-none rounded-s border border-field-border bg-surface px-3.5 py-2.5 text-[15px] font-normal outline-none focus:border-2 focus:border-ink"
        />
      </label>

      <div className="flex flex-col gap-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold" id="edit-look">Look</span>
          <span className="text-[12px] text-ink-3">Light or dark page.</span>
        </span>
        <span role="radiogroup" aria-labelledby="edit-look" className="grid grid-cols-2 rounded-full bg-[rgba(17,17,17,0.08)] p-1">
          {(["day", "night"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={d.look === l}
              onClick={() => set({ look: l, accent: isAccent(l, d.accent) ? d.accent : DEFAULT_ACCENT[l] })}
              className={`flex h-10 items-center justify-center gap-2 rounded-full text-[14px] font-semibold ${d.look === l ? "bg-ink text-night-t1" : "hover:bg-[rgba(17,17,17,0.06)]"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l === "day" ? "#E4F45A" : "#F0532A" }} />
              {l === "day" ? "Day" : "Night"}
            </button>
          ))}
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold" id="edit-accent">Accent colour</span>
          <span className="text-[12px] text-ink-3">For your photo and a few highlights. The page itself stays {d.look === "day" ? "Day" : "Night"}.</span>
        </span>
        <span role="radiogroup" aria-labelledby="edit-accent" className="flex flex-wrap gap-2.5">
          {ACCENTS[d.look].map((a) => (
            <button
              key={a.hex}
              type="button"
              role="radio"
              aria-checked={d.accent === a.hex}
              aria-label={a.name}
              title={a.name}
              onClick={() => set({ accent: a.hex })}
              className={`pop h-10 w-10 rounded-full ${d.accent === a.hex ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
              style={{ background: a.hex }}
            />
          ))}
        </span>
      </div>

      {genreOpen && <GenreSheet value={d.genres} onDone={(genres) => set({ genres })} onClose={() => setGenreOpen(false)} />}
    </Panel>
  );
}
