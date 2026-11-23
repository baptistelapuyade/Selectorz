"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { discardChanges, publishChanges, saveDraft, takeOffline, uploadPhoto } from "@/app/(build)/edit/actions";
import { track } from "@/components/analytics";
import { PhotoDialog } from "@/components/build/photo-dialog";
import { ProfileView } from "@/components/profile/profile-view";
import type { DraftPhoto } from "@/lib/build/draft";
import { MAX_SECTIONS, missing, missingMessage, move, newSection, sameDraft, summary, toPublic, type EditDraft, type EditSection, type EditState } from "@/lib/edit/model";
import { lookTokens, photoUrl, SECTION_TITLES } from "@/lib/profile";
import { AddSectionPanel } from "./add-section-panel";
import { BasicsPanel } from "./basics-panel";
import { OfflineDialog } from "./offline-dialog";
import { Arrow, Grip, useDragList } from "./panel";
import { SectionPanel } from "./section-panel";

type Open = null | { kind: "basics" } | { kind: "photo" } | { kind: "add" } | { kind: "offline" } | { kind: "section"; key: string };
type Save = "saved" | "saving" | "error";

// Profil bearbeiten nach dem ersten Veröffentlichen (M1cEditor). Alles landet im Entwurf;
// die öffentliche Seite ändert sich erst mit „Publish changes“.
export function Editor({ initial }: { initial: EditState }) {
  const [st, setSt] = useState(initial);
  const [d, setD] = useState<EditDraft>(initial.draft);
  const [open, setOpen] = useState<Open>(null);
  const [save, setSave] = useState<Save>("saved");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [photoBusy, setPhotoBusy] = useState(false);
  const seq = useRef(0);

  const set = (patch: Partial<EditDraft>) => {
    setError(null);
    setNotice(null);
    setD((cur) => ({ ...cur, ...patch }));
  };
  const setSections = (fn: (s: EditSection[]) => EditSection[]) => set({ sections: fn(d.sections) });

  // Automatisch speichern, kurz nachdem sich etwas geändert hat
  const dirty = !sameDraft(d, st.draft);
  useEffect(() => {
    if (!dirty) return;
    const n = ++seq.current;
    const snapshot = d;
    const id = setTimeout(async () => {
      setSave("saving");
      const r = await saveDraft(snapshot);
      if (n !== seq.current) return;
      if (r.ok) {
        // Inhalt wie gespeichert; die Listen-Schlüssel bleiben die lokalen
        setSt({ ...r.state, draft: snapshot });
        setSave("saved");
      } else {
        setSave("error");
        setError(r.error);
      }
    }, 700);
    return () => clearTimeout(id);
  }, [d, dirty]);

  const live = st.status === "published";
  const changed = live && (st.changed || dirty);
  const miss = missing(d);

  const publish = () => {
    if (miss.length) {
      setError(missingMessage(miss));
      return;
    }
    start(async () => {
      seq.current++; // laufendes automatisches Speichern ist damit überholt
      const r = await publishChanges(d);
      if (!r.ok) return setError(r.error);
      track("profile_changes_published", { sections: d.sections.length, look: d.look });
      setSt(r.state);
      setD(r.state.draft);
      setSave("saved");
      setError(null);
      setNotice("Published. Your page shows the new version now.");
    });
  };
  const discard = () =>
    start(async () => {
      seq.current++;
      const r = await discardChanges();
      if (!r.ok) return setError(r.error);
      setSt(r.state);
      setD(r.state.draft);
      setSave("saved");
      setError(null);
      setNotice("Changes discarded. Your draft matches your public page again.");
    });
  const offline = () =>
    start(async () => {
      const r = await takeOffline();
      if (!r.ok) return setError(r.error);
      track("profile_withdrawn");
      setSt(r.state);
      setOpen(null);
      setNotice("Your page is offline. Publish again whenever you like.");
    });

  const usePhoto = async (photo: DraftPhoto) => {
    setPhotoBusy(true);
    const form = new FormData();
    const blob = async (url: string) => (await fetch(url)).blob();
    form.set("style", photo.style);
    if (photo.style === "bw") form.set("photo_bw", await blob(photo.bw));
    else {
      form.set("photo_day", await blob(photo.day));
      form.set("photo_night", await blob(photo.night));
    }
    const r = await uploadPhoto(form);
    setPhotoBusy(false);
    if (!r.ok) return setError(r.error);
    set({ photo_path: r.path, photo_style: r.style });
  };

  const sectionOpen = open?.kind === "section" ? d.sections.find((s) => s.key === open.key) : undefined;
  const t = lookTokens(d.look, d.accent);
  const src = photoUrl(d.photo_path, d.look, d.photo_style);
  const drag = useDragList((a, b) => setSections((s) => move(s, a, b)));
  const visibleKeys = d.sections.filter((s) => s.visible).map((s) => s.key);
  const pub = toPublic(st.handle, d);
  const pubKeys = d.sections.filter((s) => s.visible && pub.sections.some((p) => p.content === s.content)).map((s) => s.key);

  const statusText = st.status === "withdrawn" ? "OFFLINE" : changed ? "LIVE · CHANGES NOT PUBLISHED" : "LIVE · UP TO DATE";
  const statusDot = st.status === "withdrawn" ? "#8A8A86" : changed ? "#F0532A" : "#2E8B57";

  return (
    <div className="flex min-h-[calc(100dvh-32px)] flex-col">
      <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-4 md:h-[72px] md:gap-6 md:px-10">
        <Link href="/" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[26px] md:tracking-[-0.045em]">Selectorz</Link>
        <Link href="/home" className="link-hover text-[14px] font-semibold underline underline-offset-4">← Home</Link>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex h-[30px] items-center gap-2 rounded-full bg-line-soft px-3 font-mono text-[10px] tracking-[0.08em]" data-testid="status">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: statusDot }} />
            <span className="hidden sm:inline">{statusText}</span>
            <span className="sm:hidden">{st.status === "withdrawn" ? "OFFLINE" : changed ? "CHANGES" : "LIVE"}</span>
          </span>
          <span className="label-mono hidden text-ink-3 md:inline" aria-live="polite">
            {save === "saving" ? "Saving…" : save === "error" ? "Not saved" : "Draft saved"}
          </span>
          <Link href="/settings" className="link-hover hidden text-[14px] font-semibold underline underline-offset-4 md:inline">Settings</Link>
          <form action="/auth/signout" method="post">
            <button className="h-9 rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-semibold hover:bg-ink hover:text-night-t1 md:h-10 md:px-5 md:text-[14px]">Log out</button>
          </form>
        </span>
      </header>

      <main className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-10 px-4 pb-32 pt-6 md:grid-cols-[440px_minmax(0,1fr)] md:px-10 md:pb-10">
        <div className="flex flex-col gap-4">
          <h1 className="sr-only">Edit your page</h1>
          {/* Grunddaten */}
          <section aria-label="Basics" className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen({ kind: "photo" })}
                aria-label="Change photo"
                className={`relative h-[60px] w-12 flex-none overflow-hidden rounded-[6px] text-[10px] font-semibold ${d.photo_path ? "" : error && miss.includes("photo") ? "need-fixed" : ""}`}
                style={{ background: d.photo_path ? t.htBg : "#E2E2DE" }}
              >
                {src && d.photo_style === "bw" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- fertiges Bild aus dem Speicher
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : src ? (
                  <span className="absolute inset-0" style={{ background: t.htDot, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "cover", maskSize: "cover" }} />
                ) : (
                  "+ Photo"
                )}
                {photoBusy && <span className="absolute inset-0 animate-pulse bg-[rgba(255,255,255,0.6)]" />}
              </button>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[20px] font-extrabold tracking-[-0.03em]">{d.display_name || "Your name"}</span>
                <span className="truncate text-[13px] text-ink-3">selectorz.art/{st.handle} · {d.look === "day" ? "Day" : "Night"}</span>
              </span>
              <button type="button" onClick={() => setOpen({ kind: "basics" })} className="h-9 flex-none rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-semibold hover:bg-ink hover:text-night-t1">
                Edit basics
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              <Chip label="Sound">{d.genres.join(" · ") || "—"}</Chip>
              <Chip label="Based">{d.city || "—"}</Chip>
              <Chip label="Plays">{d.plays.join(" · ") || "—"}</Chip>
            </div>
          </section>

          {/* Sections */}
          <section className="flex flex-col gap-2.5">
            <h2 className="flex items-center gap-2.5 border-t-2 border-ink pt-3">
              <span className="text-[22px] font-semibold leading-none tracking-[-0.02em]">Sections</span>
              <span className="label-mono ml-auto text-ink-3">{d.sections.length} of {MAX_SECTIONS}</span>
            </h2>
            <p className="text-[13px] text-ink-3">Drag or use the arrows to change the order. Switch off what you don&apos;t want to show.</p>
            <ol className="flex flex-col gap-1.5" aria-label="Sections">
              {d.sections.map((s, i) => {
                const title = s.title || SECTION_TITLES[s.kind];
                return (
                  <li key={s.key} {...drag(i)} className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface py-1.5 pl-1 pr-2" style={{ opacity: s.visible ? 1 : 0.6 }}>
                    <Grip />
                    <span className="flex h-[22px] flex-none items-center rounded-full bg-ink px-1.5 font-mono text-[10px] text-night-t1">
                      {s.visible ? String(visibleKeys.indexOf(s.key) + 1).padStart(2, "0") : "––"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-1">
                      <span className="truncate text-[15px] font-semibold">{title}</span>
                      <span className="truncate text-[12px] text-ink-3">{summary(s)}</span>
                    </span>
                    <Arrow dir="up" label={`Move ${title} up`} disabled={i === 0} onClick={() => setSections((x) => move(x, i, i - 1))} />
                    <Arrow dir="down" label={`Move ${title} down`} disabled={i === d.sections.length - 1} onClick={() => setSections((x) => move(x, i, i + 1))} />
                    <button type="button" onClick={() => setOpen({ kind: "section", key: s.key })} aria-label={`Edit ${title}`} className="h-8 flex-none rounded-full border-[1.2px] border-ink px-3 text-[12px] font-semibold hover:bg-ink hover:text-night-t1">
                      Edit
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.visible}
                      aria-label={`Show ${title} on your page`}
                      onClick={() => setSections((x) => x.map((y) => (y.key === s.key ? { ...y, visible: !y.visible } : y)))}
                      className={`flex h-7 w-11 flex-none rounded-full p-[3px] ${s.visible ? "justify-end bg-ink" : "justify-start bg-field-border"}`}
                    >
                      <span className="h-[22px] w-[22px] rounded-full bg-white" />
                    </button>
                  </li>
                );
              })}
            </ol>
            {d.sections.length < MAX_SECTIONS && (
              <button type="button" onClick={() => setOpen({ kind: "add" })} className="h-11 rounded-[8px] border-[1.5px] border-dashed border-field-border text-[14px] font-semibold text-ink-2 hover:border-ink hover:text-ink">
                + Add a section
              </button>
            )}
          </section>

          {/* Veröffentlichen */}
          <section className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t-2 border-ink bg-bg px-4 pb-5 pt-4 md:static md:mt-auto md:px-0 md:pb-6">
            {error ? (
              <p key={error} role="alert" className="shake rounded-[8px] border-[1.5px] border-error-border bg-[#FBE9E4] px-3.5 py-3 text-[14px] font-semibold leading-[1.4] text-error-text">{error}</p>
            ) : notice ? (
              <p role="status" className="text-[14px] leading-[1.45] text-ok">{notice}</p>
            ) : (
              <p className="hidden text-[14px] leading-[1.45] text-ink-2 md:block">
                {st.status === "withdrawn"
                  ? "Your page is offline. Publish to bring it back."
                  : changed
                    ? "Your changes are only in your draft. Your public page still shows the old version."
                    : "Your public page is up to date."}
              </p>
            )}
            <span className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={publish}
                disabled={pending || (live && !changed)}
                className={`cta flex h-[58px] flex-1 items-center justify-between rounded-full px-6 text-[16px] font-semibold text-night-t1 ${live && !changed ? "bg-field-border" : "bg-ink shadow-cta"}`}
              >
                {pending ? "Working…" : st.status === "withdrawn" ? "Publish again" : "Publish changes"} <span aria-hidden className="cta-arrow">→</span>
              </button>
              {changed && (
                <button type="button" onClick={discard} disabled={pending} className="link-hover flex-none text-[13px] font-semibold text-ink-2 underline underline-offset-4">
                  Discard changes
                </button>
              )}
            </span>
            {live && (
              <button type="button" onClick={() => setOpen({ kind: "offline" })} className="self-start text-[13px] font-semibold text-error-text underline-offset-4 hover:underline">
                Take my page offline
              </button>
            )}
          </section>
        </div>

        <Preview>
          <ProfileView
            p={pub}
            profileId={st.id}
            accountId=""
            edit={{
              photo: () => setOpen({ kind: "photo" }),
              basics: () => setOpen({ kind: "basics" }),
              section: (i) => pubKeys[i] && setOpen({ kind: "section", key: pubKeys[i] }),
            }}
          />
        </Preview>
      </main>

      {open?.kind === "basics" && <BasicsPanel d={d} handle={st.handle} set={set} onPhoto={() => setOpen({ kind: "photo" })} onClose={() => setOpen(null)} />}
      {open?.kind === "photo" && (
        <PhotoDialog look={d.look} tint={t.htBg} dots={t.htDot} start={d.photo_style} onUse={usePhoto} onClose={() => setOpen(null)} />
      )}
      {open?.kind === "add" && (
        <AddSectionPanel
          sections={d.sections}
          onAdd={(k) => {
            const s = newSection(k);
            set({ sections: [...d.sections, s] });
            setOpen({ kind: "section", key: s.key });
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {sectionOpen && (
        <SectionPanel
          s={sectionOpen}
          set={(s) => setSections((x) => x.map((y) => (y.key === s.key ? s : y)))}
          onRemove={() => {
            setSections((x) => x.filter((y) => y.key !== sectionOpen.key));
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === "offline" && <OfflineDialog handle={st.handle} pending={pending} onConfirm={offline} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-surface-sunken px-2.5">
      <span className="flex-none font-mono text-[10px] font-semibold tracking-[0.1em] text-ink">{label.toUpperCase()}</span>
      <span className="truncate text-[12px] text-ink-3">{children}</span>
    </span>
  );
}

// Vorschau der Seite im Desktop-Format, verkleinert in die rechte Spalte (nur Desktop)
function Preview({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0.6, h: 800 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / 1280);
      setBox({ scale, h: i.offsetHeight * scale });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    measure();
    return () => ro.disconnect();
  }, []);
  return (
    <section aria-label="Preview of your draft" className="hidden min-w-0 flex-col rounded-[16px] bg-ink p-2 shadow-[0_40px_90px_rgba(0,0,0,0.16)] md:sticky md:top-6 md:flex md:h-[calc(100dvh-140px)]">
      <span className="flex h-[30px] flex-none items-center justify-between px-2.5 font-mono text-[10px] tracking-[0.1em] text-night-t3">
        <span>PREVIEW OF YOUR DRAFT</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lime" />CLICK ANYTHING TO EDIT</span>
      </span>
      <div ref={outer} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[10px] bg-surface">
        <div style={{ height: box.h }}>
          <div ref={inner} className="flex w-[1280px] origin-top-left flex-col" style={{ transform: `scale(${box.scale})` }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
