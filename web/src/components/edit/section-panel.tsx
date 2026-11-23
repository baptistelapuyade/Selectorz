"use client";

import { useState } from "react";
import { TrackInput, WorksWith } from "@/components/build/track-input";
import type { DraftTrack } from "@/lib/build/draft";
import { move, NOTE_MAX, TEXT_MAX, tracksOf, type EditSection } from "@/lib/edit/model";
import { providerOf, PROVIDER_LABEL, SECTION_TITLES, type Track } from "@/lib/profile";
import { Arrow, Grip, Panel, useDragList } from "./panel";

type Props = { s: EditSection; set: (s: EditSection) => void; onRemove: () => void; onClose: () => void };

const INTRO: Partial<Record<EditSection["kind"], string>> = {
  mix: "One mix of yours. It plays right on your page.",
  star_track: "The one track that says who you are.",
  set_openers: "One to three tracks you'd open a set with. They play right on your page.",
  set_closers: "One to three tracks for the last ten minutes.",
  tracks: "Up to three records you always carry.",
  text: "A few lines on how you play.",
};

const clean = (t: DraftTrack): Track & { provider: string } => ({
  url: t.url,
  title: t.title.trim(),
  ...(t.artist?.trim() ? { artist: t.artist.trim() } : {}),
  provider: t.provider,
});
const asDraft = (t: Track): DraftTrack => ({ ...t, provider: providerOf(t.url), fetched: "ok" });

// Eine Section bearbeiten (M1cSection): Inhalt je Typ, Titel, entfernen.
export function SectionPanel({ s, set, onRemove, onClose }: Props) {
  const list = s.kind === "set_openers" || s.kind === "set_closers" || s.kind === "tracks";
  return (
    <Panel
      title={s.title || SECTION_TITLES[s.kind]}
      onClose={onClose}
      footer={
        <button type="button" onClick={onRemove} className="text-[14px] font-semibold text-error-text underline underline-offset-4">
          Remove section
        </button>
      }
    >
      <p className="text-[15px] leading-[1.45] text-ink-2">{INTRO[s.kind]}</p>
      {list && <TrackList s={s} set={set} />}
      {(s.kind === "mix" || s.kind === "star_track") && <OneTrack s={s} set={set} />}
      {s.kind === "text" && (
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          <span className="flex justify-between">Your text <span className="text-[12px] font-normal text-ink-3">{String(s.content.text ?? "").length} of {TEXT_MAX}</span></span>
          <textarea
            rows={5}
            maxLength={TEXT_MAX}
            value={String(s.content.text ?? "")}
            onChange={(e) => set({ ...s, content: { text: e.target.value } })}
            className="field resize-none rounded-s border border-field-border bg-surface px-3.5 py-3 text-[16px] font-normal outline-none focus:border-2 focus:border-ink"
          />
        </label>
      )}
      <label className="mt-2 flex flex-col gap-1.5 text-[14px] font-semibold">
        Section title
        <input
          value={s.title}
          maxLength={60}
          placeholder={SECTION_TITLES[s.kind]}
          onChange={(e) => set({ ...s, title: e.target.value })}
          className="field h-11 rounded-s border border-field-border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink"
        />
      </label>
    </Panel>
  );
}

function OneTrack({ s, set }: { s: EditSection; set: (s: EditSection) => void }) {
  const first = tracksOf(s)[0];
  const [t, setT] = useState<DraftTrack | null>(first ? asDraft(first) : null);
  const write = (next: DraftTrack | null) => {
    setT(next);
    const ok = next && next.url && next.title.trim();
    if (s.kind === "mix") set({ ...s, content: { ...s.content, mixes: ok ? [clean(next)] : [] } });
    else set({ ...s, content: { ...s.content, track: ok ? clean(next) : null } });
  };
  return (
    <>
      <TrackInput label={s.kind === "mix" ? "Link to your mix" : "Link to your star track"} placeholder="Paste a link" track={t} onChange={write} />
      <WorksWith />
      {s.kind === "star_track" && (
        <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
          <span className="flex justify-between">Why this one <span className="text-[12px] font-normal text-ink-3">optional · {String(s.content.note ?? "").length} of {NOTE_MAX}</span></span>
          <input
            value={String(s.content.note ?? "")}
            maxLength={NOTE_MAX}
            onChange={(e) => set({ ...s, content: { ...s.content, note: e.target.value } })}
            className="field h-11 rounded-s border border-field-border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink"
          />
        </label>
      )}
    </>
  );
}

function TrackList({ s, set }: { s: EditSection; set: (s: EditSection) => void }) {
  const tracks = tracksOf(s);
  const [pending, setPending] = useState<DraftTrack | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const put = (next: Track[]) => set({ ...s, content: { ...s.content, tracks: next } });
  const drag = useDragList((a, b) => put(move(tracks, a, b)));
  const add = () => {
    if (!pending?.url || !pending.title.trim()) return;
    put([...tracks, clean(pending)].slice(0, 3));
    setPending(null);
    setInputKey((k) => k + 1);
  };
  return (
    <>
      {tracks.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Tracks">
          {tracks.map((tr, i) => (
            <li key={tr.url} {...drag(i)} className="flex min-h-[64px] items-center gap-2 rounded-l bg-surface py-2 pl-1 pr-2">
              <Grip />
              <span className="font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">{tr.title}</span>
                <span className="truncate text-[12px] text-ink-3">{[tr.artist, PROVIDER_LABEL[providerOf(tr.url)]].filter(Boolean).join(" · ")}</span>
              </span>
              <Arrow dir="up" label={`Move ${tr.title} up`} disabled={i === 0} onClick={() => put(move(tracks, i, i - 1))} />
              <Arrow dir="down" label={`Move ${tr.title} down`} disabled={i === tracks.length - 1} onClick={() => put(move(tracks, i, i + 1))} />
              <button type="button" aria-label={`Remove ${tr.title}`} onClick={() => put(tracks.filter((_, j) => j !== i))} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[20px] text-ink-3 hover:bg-bg">
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      {tracks.length < 3 && (
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">
            {tracks.length === 0 ? "Add a track" : `Add track ${tracks.length + 1}`} {tracks.length > 0 && <span className="text-[12px] font-normal text-ink-3">optional</span>}
          </span>
          <TrackInput key={inputKey} label={`Link for track ${tracks.length + 1}`} placeholder="Paste a track link" track={pending} onChange={setPending} manualSuffix={` of track ${tracks.length + 1}`} />
          {pending?.url && (
            <button
              type="button"
              disabled={!pending.title.trim()}
              onClick={add}
              className="h-11 self-start rounded-full bg-ink px-5 text-[14px] font-semibold text-night-t1 disabled:bg-field-border"
            >
              Add track
            </button>
          )}
          <WorksWith />
        </div>
      )}
    </>
  );
}
