"use client";

import { useState, useTransition } from "react";
import { deleteGig, saveGig, type GigInput } from "@/app/(build)/edit/gig-actions";
import { track } from "@/components/analytics";
import { gigDate, gigLabel, gigToday, linkLabel, played, upcoming, type Gig } from "@/lib/gigs";
import { useGigToday } from "@/components/use-gig-today";
import { Panel } from "./panel";

type Props = {
  gigs: Gig[];
  city: string;                         // Stadt vorausgefüllt aus „Based“
  handle: string;
  onGigs: (g: Gig[]) => void;
  onStory: (kind: "one" | "all", gig?: Gig) => void;
  onClose: () => void;
};

type Field = "date" | "event" | "city" | "url";
const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

// Next gigs im Editor (Boards GigsEditor, …Added, …Edit, …Saved, …Error). Speichern = sofort live.
export function GigsPanel({ gigs, city, handle, onGigs, onStory, onClose }: Props) {
  const [added, setAdded] = useState<Gig | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Gig | null>(null);
  const [showPlayed, setShowPlayed] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const today = useGigToday() ?? gigToday();
  const next = upcoming(gigs, today);
  const past = played(gigs, today);

  return (
    <Panel
      title="Next gigs"
      onClose={onClose}
      footer={
        <span className="flex items-center gap-2 text-[13px] leading-[1.35] text-ink-2">
          <span className="h-2 w-2 flex-none rounded-full bg-ok" />
          Gigs go on your page right away. No need to publish.
        </span>
      }
    >
      {added ? (
        <p role="status" className="flex items-center gap-2.5 rounded-l bg-[#E3F2E8] px-3.5 py-3 text-[13px] font-semibold leading-[1.35] text-[#1E6B40]">
          {CHECK}
          <span className="flex-1">Added {gigLabel(added.date, today)}, {added.event}. It&apos;s on your page now.</span>
          <button type="button" onClick={() => onStory("one", added)} className="h-9 flex-none rounded-full bg-ink px-3.5 text-[13px] font-semibold text-night-t1 shadow-cta">
            Make a story →
          </button>
        </p>
      ) : null}

      <GigForm
        key={formKey}
        title="Add a gig"
        initial={{ date: "", event: "", city, url: "" }}
        submit="Add gig"
        onSaved={(g, all) => {
          onGigs(all);
          setAdded(g);
          setFormKey((k) => k + 1);
          track("gig_added", { has_link: !!g.url });
        }}
      />

      {removed && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-l bg-ink px-4 py-3 text-[13px] text-night-t1">
          Gig removed.
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            onClick={async () => {
              const r = await saveGig({ date: removed.date, event: removed.event, city: removed.city, url: removed.url ?? "" });
              if (r.ok) onGigs(r.gigs);
              setRemoved(null);
            }}
          >
            Undo
          </button>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Coming up</span>
            <span className="label-mono text-ink-3">{next.length ? `${next.length} gig${next.length === 1 ? "" : "s"} · first 3 on your page` : "Nothing yet"}</span>
          </span>
          {next.length > 1 && (
            <button type="button" onClick={() => onStory("all")} className="h-9 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-night-t1">
              Share next {Math.min(3, next.length)} gigs
            </button>
          )}
        </span>
        <ol className="flex flex-col gap-1.5" aria-label="Coming up">
          {next.map((g) =>
            editing === g.id ? (
              <li key={g.id}>
                <GigForm
                  title="Edit gig"
                  initial={{ id: g.id, date: g.date, event: g.event, city: g.city, url: g.url ?? "" }}
                  submit="Save"
                  onCancel={() => setEditing(null)}
                  onSaved={(s, all) => {
                    onGigs(all);
                    setEditing(null);
                    setSaved(s.id);
                  }}
                />
              </li>
            ) : (
              <li key={g.id} className="flex flex-col gap-1">
                <GigRow g={g} onStory={() => onStory("one", g)} onEdit={() => { setEditing(g.id); setSaved(null); }} onRemove={async () => {
                  const r = await deleteGig(g.id);
                  if (r.ok) {
                    onGigs(r.gigs);
                    setRemoved(g);
                  }
                }} />
                {saved === g.id && (
                  <p role="status" className="flex items-center gap-2 rounded-[10px] bg-[#E3F2E8] px-3 py-2 text-[13px] font-semibold text-[#1E6B40]">
                    {CHECK}
                    <span className="flex-1">Saved. Live on your page now, no need to publish.</span>
                    <a href={`/${handle}`} target="_blank" rel="noopener" className="underline underline-offset-[3px]">View ↗</a>
                  </p>
                )}
              </li>
            ),
          )}
        </ol>
      </div>

      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showPlayed}
            onClick={() => setShowPlayed((s) => !s)}
            className="flex h-[52px] items-center justify-between rounded-l border border-line px-4 text-left text-[14px] text-ink-2"
          >
            <span><b className="text-ink">Played at</b> · {past.length} past gig{past.length === 1 ? "" : "s"}, saved for later. Not on your page.</span>
            <span aria-hidden>{showPlayed ? "▴" : "▾"}</span>
          </button>
          {showPlayed && (
            <ul className="flex flex-col gap-1 px-1">
              {past.map((g) => (
                <li key={g.id} className="flex justify-between gap-3 border-t border-line-soft py-2 text-[13px] text-ink-2">
                  <span className="truncate">{g.event} · {g.city}</span>
                  <span className="flex-none font-mono text-[11px] text-ink-3">{gigLabel(g.date, today)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function GigRow({ g, onStory, onEdit, onRemove }: { g: Gig; onStory: () => void; onEdit: () => void; onRemove: () => void }) {
  const d = gigDate(g.date);
  const label = linkLabel(g.url);
  return (
    <span className="flex min-h-16 items-center gap-2.5 rounded-l bg-surface py-2 pl-3.5 pr-2">
      <span className="flex w-[70px] flex-none flex-col">
        <span className="font-mono text-[10px] tracking-[0.1em] text-ink-3">{d.wd}</span>
        <span className="text-[17px] font-extrabold tracking-[-0.03em]">{d.day} {d.mon.charAt(0) + d.mon.slice(1).toLowerCase()}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{g.event}</span>
        <span className="truncate text-[12px] text-ink-3">{g.city}{label ? ` · ${label} ↗` : " · no link"}</span>
      </span>
      <button type="button" onClick={onStory} aria-label={`Make a story for ${g.event}`} className="h-8 flex-none rounded-full border-[1.2px] border-ink px-3 text-[12px] font-semibold hover:bg-ink hover:text-night-t1">
        Story
      </button>
      <button type="button" onClick={onEdit} aria-label={`Edit ${g.event}`} className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-bg">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
      </button>
      <button type="button" onClick={onRemove} aria-label={`Delete ${g.event}`} className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[20px] text-ink-3 hover:bg-bg">
        ×
      </button>
    </span>
  );
}

function GigForm({ title, initial, submit, onSaved, onCancel }: { title: string; initial: GigInput; submit: string; onSaved: (g: Gig, all: Gig[]) => void; onCancel?: () => void }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<{ text: string; field?: Field } | null>(null);
  const [pending, start] = useTransition();
  const today = gigToday();
  const bad = (f: Field) => (err?.field === f ? "border-2 border-error-border bg-[#FFF7F5]" : "border-field-border");
  const set = (patch: Partial<GigInput>) => {
    setV((x) => ({ ...x, ...patch }));
    setErr(null);
  };
  return (
    <form
      aria-label={title}
      className={`flex flex-col gap-2.5 rounded-l bg-surface p-4 ${initial.id ? "shadow-[0_0_0_2px_#111111]" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveGig(v);
          if (!r.ok) return setErr({ text: r.error, field: r.field });
          onSaved(r.gig, r.gigs);
        });
      }}
    >
      <span className="flex items-center justify-between">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="label-mono text-ink-3">Date, place, city</span>
      </span>
      <span className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          Date
          <input type="date" required min={initial.id ? undefined : today} value={v.date} onChange={(e) => set({ date: e.target.value })} className={`field h-11 rounded-s border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink ${bad("date")}`} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          Event or club
          <input required maxLength={80} value={v.event} placeholder="Late Hours at Kiez Klub" onChange={(e) => set({ event: e.target.value })} className={`field h-11 rounded-s border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink ${bad("event")}`} />
        </label>
      </span>
      <span className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          City
          <input required maxLength={60} value={v.city} onChange={(e) => set({ city: e.target.value })} className={`field h-11 rounded-s border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink ${bad("city")}`} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          <span>Link <span className="font-normal text-ink-3">optional · RA, tickets or Instagram</span></span>
          <input inputMode="url" maxLength={500} value={v.url} placeholder="Paste a link" onChange={(e) => set({ url: e.target.value })} className={`field h-11 rounded-s border bg-surface px-3 text-[15px] font-normal outline-none focus:border-2 focus:border-ink ${bad("url")}`} />
        </label>
      </span>
      <span className="text-[12px] text-ink-3">Playing after midnight? Use the date the night starts.</span>
      {err && (
        <p role="alert" className="text-[13px] font-semibold leading-[1.4] text-error-text">{err.text}</p>
      )}
      <span className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-10 rounded-full border-[1.5px] border-ink px-4 text-[13px] font-semibold">Cancel</button>
        )}
        <button type="submit" disabled={pending} className="h-11 rounded-full bg-ink px-5 text-[14px] font-semibold text-night-t1 disabled:bg-field-border">
          {pending ? "Saving…" : submit}
        </button>
      </span>
    </form>
  );
}
