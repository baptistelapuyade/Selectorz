"use client";

import Link from "next/link";
import { PlayButton, PlayFrame, PlayProvider } from "@/components/chain/ui";
import { ReportLink } from "@/components/profile/report-sheet";
import { ShareButton } from "@/components/profile/share-button";
import { firstName, type Role } from "@/lib/chains";
import { PROVIDER_LABEL, providerOf } from "@/lib/profile";
import { palette, pickLabel, selectionTitle, type SelPerson, type Selection } from "@/lib/selection";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const month = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "Europe/Berlin" }).toUpperCase();

// Öffentliche Selection (Board DeskSelection, PUBLISH-05): neutraler Selectorz-Look, nur die Akzente der beiden.
// Kein „Play all“ (MEDIA-10): jeder Track spielt einzeln auf seiner Plattform.
export function SelectionView({ s }: { s: Selection }) {
  const a = s.participants.find((p) => p.role === "A")!;
  const b = s.participants.find((p) => p.role === "B")!;
  const names: Record<Role, string> = { A: a.name, B: b.name };
  const col = palette(s.participants);
  const title = selectionTitle(s, a.name, b.name);
  const heights = [4, 5, 6, 10, 13, 16];

  return (
    <PlayProvider>
      <div className="flex flex-1 flex-col bg-surface text-ink">
        <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-5 md:px-10 md:py-8">
          <Link href="/" className="text-[22px] font-extrabold tracking-[-0.045em] md:text-[34px]">Selectorz</Link>
          <span className="flex items-center gap-4">
            <ShareButton name={title} color="#111111" />
            <Link href="/" className="hidden text-[15px] font-semibold md:block">Get your page</Link>
          </span>
        </header>

        <main className="mx-auto flex w-full max-w-[1280px] flex-col px-4 md:px-10">
          <section className="grid gap-10 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,504px)] md:gap-16 md:pt-10">
            <div className="flex min-w-0 flex-col gap-6">
              <span className="label-mono text-ink-2">JOINT SELECTION · {s.entries.length} TRACKS · COMPLETED {month(s.completed_at)}</span>
              <h1 className="text-[64px] font-extrabold leading-[0.86] tracking-[-0.065em] md:text-[140px] [overflow-wrap:anywhere]">{title}</h1>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Person p={a} color={col[a.role]} ring={col.white} /> <span aria-hidden className="text-ink-3">×</span> <Person p={b} color={col[b.role]} ring={col.white} />
              </span>
              <p className="max-w-[560px] text-[18px] leading-[1.45]">
                {firstName(a.name)} and {firstName(b.name)} took turns picking tracks. One picks, the other answers with the next. {s.entries.length} tracks, back and forth, in the order below.
              </p>
            </div>
            {/* Hin und Her als Punktsäulen in den Personenfarben */}
            <div className="flex aspect-square flex-col justify-between rounded-[18px] bg-night-bg p-5 text-night-t3 md:aspect-auto md:h-[460px]" aria-hidden>
              <span className="flex justify-between label-mono"><span>BACK AND FORTH</span><span>{s.entries.length}/{s.target}</span></span>
              <span className="grid grid-cols-6 items-end gap-3">
                {s.entries.map((e, i) => (
                  <span key={e.position} className="grid w-fit grid-cols-3 gap-1">
                    {Array.from({ length: heights[i] * 3 }, (_, k) => (
                      <span key={k} className="h-2 w-2 rounded-full md:h-3.5 md:w-3.5" style={{ background: col[e.role], boxShadow: col.white ? "inset 0 0 0 1px #111" : undefined }} />
                    ))}
                  </span>
                ))}
              </span>
              <span className="grid grid-cols-6 font-mono text-[11px]">{s.entries.map((e) => <span key={e.position}>{String(e.position).padStart(2, "0")}</span>)}</span>
            </div>
          </section>

          <section className="grid gap-12 pt-16 md:grid-cols-[minmax(0,1fr)_340px] md:gap-16 md:pt-24">
            <div className="min-w-0">
              <h2 className="flex items-baseline justify-between border-b-2 border-ink pb-3">
                <span className="text-[24px] font-semibold tracking-[-0.02em]">Tracklist</span>
                <span className="label-mono text-ink-2">IN THE ORDER THEY PICKED IT</span>
              </h2>
              <ol className="m-0 list-none p-0">
                {s.entries.map((e) => (
                  <li key={e.position} className="border-b border-line py-4" data-testid={`sel-entry-${e.position}`}>
                    <span className="flex items-center gap-4">
                      <span className="flex w-24 flex-none flex-col gap-1">
                        <span className="flex h-[26px] w-10 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
                          style={col.white ? (e.role === "A" ? { background: "#111", color: "#fff" } : { boxShadow: "inset 0 0 0 1.5px #111" }) : { background: col[e.role] }}>
                          {String(e.position).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">{pickLabel(e, names, e.role).toUpperCase()}</span>
                      </span>
                      <PlayButton id={`s${e.position}`} url={e.url} title={e.title} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[19px] font-extrabold leading-tight tracking-[-0.03em] [overflow-wrap:anywhere]">{e.title}</span>
                        <span className="text-[13px] text-ink-3">{[e.artist, PROVIDER_LABEL[providerOf(e.url)]].filter(Boolean).join(" · ")}</span>
                        {e.comment && <span className="pt-1 text-[14px] italic text-ink-2">“{e.comment}”</span>}
                      </span>
                      <a href={e.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${e.title} on ${PROVIDER_LABEL[providerOf(e.url)]}`} className="flex-none px-1 text-[16px]">↗</a>
                    </span>
                    <PlayFrame id={`s${e.position}`} url={e.url} title={e.title} />
                  </li>
                ))}
              </ol>
            </div>
            <aside className="flex flex-col gap-8">
              <div>
                <h2 className="border-b-2 border-ink pb-3 text-[24px] font-semibold tracking-[-0.02em]">The selectors</h2>
                <ul className="m-0 list-none p-0">
                  {[a, b].map((p) => (
                    <li key={p.role} className="flex items-center gap-4 border-b border-line py-4">
                      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-mono text-[13px] font-semibold"
                        style={{ background: col[p.role], boxShadow: col.white ? "inset 0 0 0 1.5px #111" : undefined }}>{initials(p.name)}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[18px] font-semibold">{p.name}</span>
                        {p.handle ? (
                          <Link href={`/${p.handle}`} className="text-[14px] font-semibold underline underline-offset-4">View profile →</Link>
                        ) : (
                          <span className="text-[13px] text-ink-3">No public page yet</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3">
                <span className="label-mono text-ink-2">WHAT’S A TRACK CHAIN?</span>
                <p className="text-[16px] leading-[1.45]">Two DJs, six tracks. You pick one, send the link, the other DJ answers with the next. A way to find out how someone plays, before you ever share a booth.</p>
                <p className="text-[13px] text-ink-3">Every track plays on its own platform. This is a selection, not a mixed set.</p>
              </div>
            </aside>
          </section>

          <section className="grid gap-6 py-16 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:py-24">
            <div className="flex flex-col gap-3">
              <span className="label-mono text-ink-2">TRACK CHAIN</span>
              <p className="text-[40px] font-extrabold leading-[0.95] tracking-[-0.055em] md:text-[56px]">Make one of your own.</p>
              <p className="text-[16px]">Pick a track, send the link to another DJ. Back and forth, six tracks in total.</p>
            </div>
            <div className="flex flex-col items-stretch gap-3 md:items-center">
              <Link href="/chain/new" className="cta flex h-[64px] items-center justify-between gap-10 rounded-full bg-ink px-7 text-[18px] font-semibold text-night-t1 shadow-cta md:w-[380px]">
                Start a track chain <span aria-hidden className="cta-arrow">→</span>
              </Link>
              <Link href="/" className="text-center text-[15px] font-semibold underline underline-offset-4">Or make your own DJ page</Link>
            </div>
          </section>
        </main>

        <footer className="mt-auto bg-night-bg text-night-t1">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-3.5 px-4 pb-5 pt-7 md:px-10">
            <span className="text-[72px] font-extrabold leading-[0.85] tracking-[-0.06em] md:text-center md:text-[200px]">Selectorz</span>
            <span className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-[0.08em]">
              <span>YOUR SOUND, ONE LINK</span>
              <span className="flex gap-4">
                <Link href="/privacy" className="hover:underline">PRIVACY</Link>
                <Link href="/imprint" className="hover:underline">IMPRINT</Link>
                <ReportLink targetType="chain" targetId={s.id} accountId="" name={title} color="#EDEDEA" />
                <Link href="/" className="hover:underline">GET YOUR PAGE ↗</Link>
              </span>
            </span>
          </div>
        </footer>
      </div>
    </PlayProvider>
  );
}

function Person({ p, color, ring }: { p: SelPerson; color: string; ring: boolean }) {
  const dot = <span className="h-6 w-6 flex-none rounded-full" style={{ background: color, boxShadow: ring ? "inset 0 0 0 1.5px #111" : undefined }} />;
  return p.handle ? (
    <Link href={`/${p.handle}`} className="flex items-center gap-2.5 text-[17px] font-semibold hover:underline">{dot}{p.name}</Link>
  ) : (
    <span className="flex items-center gap-2.5 text-[17px] font-semibold">{dot}{p.name}</span>
  );
}
