import Link from "next/link";
import { FeedbackButton } from "@/components/alpha-bar";
import { lookTokens, mmss, photoUrl, providerOf, PROVIDER_LABEL, SECTION_TITLES, type PublicProfile, type Section } from "@/lib/profile";
import type { Gig } from "@/lib/gigs";
import type { ProfileSelection } from "@/lib/selection";
import { GigsSection } from "./gigs-section";
import { SelectionsSection } from "./selections-section";
import { PlayerCard, PlayerProvider, TrackRow } from "./player";
import { ShareButton } from "./share-button";
import { ReportLink } from "./report-sheet";

type T = ReturnType<typeof lookTokens>;

// Im Editor: Vorschau mit Knöpfen direkt an Foto, Name und Sections (M1cEditor „Click anything to edit“)
export type EditHooks = { photo: () => void; basics: () => void; section: (i: number) => void; gigs?: () => void; links?: () => void };

function EditPill({ label, onClick, t, className = "" }: { label: string; onClick: () => void; t: T; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`z-10 flex h-11 items-center gap-2 rounded-full px-4 text-[16px] font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.18)] ${className}`}
      style={{ background: t.fg, color: t.bg }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
      {label}
    </button>
  );
}

// Öffentliches Profil nach den Boards „Profil Day/Night“ (mobil) und „Desktop · Profil“.
export function ProfileView({ p, profileId, accountId, edit, gigs = [], selections = [] }: { p: PublicProfile; profileId: string; accountId: string; edit?: EditHooks; gigs?: Gig[]; selections?: ProfileSelection[] }) {
  const t = lookTokens(p.look, p.accent);
  const first = p.display_name.split(" ")[0] || p.display_name;
  const tick = [p.display_name, p.city, p.genres.join(" · "), p.plays.join(" · ")].filter(Boolean).map((s) => s!.toUpperCase());
  // Eine Hälfte des Laufbands: Wörter mehrfach, mindestens so breit wie der Bildschirm (nahtloser Loop)
  const run = [...tick, ...tick, ...tick, ...tick];
  const sections = p.sections.filter((s) => hasContent(s));

  return (
    <PlayerProvider>
      <div className="flex flex-1 flex-col" style={{ background: t.bg, color: t.fg }} data-look={p.look}>
        {/* Laufband mit Alpha-Hinweis und Feedback (ein Balken pro Seite) */}
        <div className="flex h-8 items-center gap-3 overflow-hidden pl-3 pr-2 font-mono text-[10px] tracking-[0.08em] md:pl-6 md:text-[11px]" style={{ background: t.tickBg, color: t.tickFg }}>
          <span className="flex-none font-semibold">ALPHA</span>
          <span className="h-3 w-px flex-none opacity-40" style={{ background: t.tickFg }} />
          <span className="marquee-mask flex flex-1 overflow-hidden">
            <span className="marquee flex w-max whitespace-nowrap" aria-hidden="true">
              {[0, 1].map((half) => (
                <span key={half} data-marquee-half className="flex min-w-[100vw] flex-none justify-around">
                  {run.map((w, i) => (
                    <span key={i} className="flex gap-3.5 pr-3.5"><span>{w}</span><span>→</span></span>
                  ))}
                </span>
              ))}
            </span>
          </span>
          {!edit && <FeedbackButton />}
        </div>

        <div className="mx-auto w-full max-w-[1280px] md:px-10">
          <header className="flex h-14 items-center justify-between px-4 md:h-24 md:px-0">
            <Link href="/" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[38px] md:tracking-[-0.045em]">Selectorz</Link>
            {!edit && <span className="hidden md:block"><ShareButton name={p.display_name} color={t.fg} /></span>}
          </header>

          {/* Hero: Name und Info-Leiste links, Foto rechts (Desktop); untereinander (mobil) */}
          <section className="md:mt-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
            <div className="flex min-w-0 flex-col justify-between gap-5 md:gap-14">
              <div className="flex flex-col gap-4 px-4 pt-6 md:px-0 md:pr-10 md:pt-0">
                <p className="hidden font-mono text-[12px] tracking-[0.08em] md:block" style={{ color: t.muted }}>@{p.handle.toUpperCase()} · DJ · SELECTOR</p>
                <h1 className="break-words text-[clamp(56px,20vw,84px)] font-extrabold leading-[0.86] tracking-[-0.055em] md:text-[clamp(84px,11vw,168px)] md:leading-[0.84] md:tracking-[-0.06em]">
                  {p.display_name}
                </h1>
                {edit && <EditPill label="Edit basics" onClick={edit.basics} t={t} className="self-start" />}
                {p.bio && <p className="max-w-[560px] text-[17px] leading-[1.4] md:text-[20px]" style={{ color: t.muted }}>{p.bio}</p>}
                <div className="flex items-center justify-between gap-3 md:hidden">
                  <p className="truncate font-mono text-[11px] tracking-[0.08em]" style={{ color: t.muted }}>@{p.handle.toUpperCase()} · DJ · SELECTOR</p>
                  {!edit && <ShareButton name={p.display_name} color={t.fg} />}
                </div>
              </div>
              <InfoBar p={p} t={t} />
            </div>
            <div className="relative md:self-end">
              <Photo p={p} t={t} />
              {edit && <EditPill label="Change photo" onClick={edit.photo} t={t} className="absolute bottom-3 left-3" />}
            </div>
          </section>

          {p.links.length > 0 &&
            (edit?.links ? (
              <div className="relative">
                <Links p={p} t={t} />
                <EditPill label="Edit links" onClick={edit.links} t={t} className="absolute -bottom-14 right-0" />
              </div>
            ) : (
              <Links p={p} t={t} />
            ))}

          {/* Next gigs: unter Foto und Links, eigene Section mit Überschrift (Variante B2) */}
          <GigsSection gigs={gigs} name={p.display_name} t={t} onEdit={edit?.gigs && <EditPill label="Edit gigs" onClick={edit.gigs} t={t} />} />

          {/* Module: mobil untereinander, Desktop zweispaltig */}
          <div className="mt-12 grid gap-12 px-4 md:mt-16 md:grid-cols-2 md:gap-x-12 md:gap-y-14 md:px-0">
            {sections.map((s, i) =>
              edit ? (
                <div key={i} className="relative">
                  <SectionBlock n={i + 1} s={s} t={t} />
                  <EditPill label="Edit" onClick={() => edit.section(p.sections.indexOf(s))} t={t} className="absolute right-0 top-2.5" />
                </div>
              ) : (
                <SectionBlock key={i} n={i + 1} s={s} t={t} />
              ),
            )}
          </div>

          {/* Freigegebene Selections (PUBLISH-06) */}
          <SelectionsSection list={selections} t={t} />
        </div>

        {/* Abschluss: Track-Kette und Footer */}
        <div className="mt-auto flex flex-col pt-20">
          <section className="border-t-2" style={{ background: t.ctaBg, borderColor: t.fg }}>
            <div className="mx-auto grid max-w-[1280px] gap-8 px-4 pb-16 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-12 md:px-10 md:pb-20 md:pt-14">
              <div className="flex flex-col gap-4">
                <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: t.muted }}>TRACK CHAIN</span>
                <p className="text-[30px] font-extrabold leading-none tracking-[-0.04em] md:text-[56px]">Play a round<br />with {first}.</p>
                <p className="max-w-md text-[15px] leading-[1.45]" style={{ color: t.muted }}>
                  You pick track 1, {first} answers. Back and forth, six tracks in total.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 md:items-end">
                <Link
                  href="/chain/new"
                  className="cta flex h-[58px] w-full items-center justify-between gap-6 rounded-full px-6 text-[16px] font-semibold md:w-[340px]"
                  style={{ background: t.btnBg, color: t.btnFg }}
                >
                  <span>Start a track chain</span>
                  <span aria-hidden className="cta-arrow">→</span>
                </Link>
                <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: t.muted }}>THEN SEND THE LINK TO {first.toUpperCase()}</span>
              </div>
            </div>
          </section>
          <footer style={{ background: t.footBg, color: t.footFg }}>
           <div className="mx-auto flex max-w-[1280px] flex-col gap-3.5 px-4 pb-5 pt-7 md:px-10">
            <span className="text-[72px] font-extrabold leading-[0.85] tracking-[-0.06em] md:text-center md:text-[200px]">Selectorz</span>
            <span className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-[0.08em]">
              <span>YOUR SOUND, ONE LINK</span>
              <span className="flex gap-4">
                <Link href="/privacy" className="hover:underline">PRIVACY</Link>
                <Link href="/imprint" className="hover:underline">IMPRINT</Link>
                {!edit && <ReportLink targetType="profile" targetId={profileId} accountId={accountId} name={p.display_name} color={t.footFg} />}
                <Link href="/" className="link-hover hover:underline">GET YOUR PAGE ↗</Link>
              </span>
            </span>
           </div>
          </footer>
        </div>
      </div>
    </PlayerProvider>
  );
}

function hasContent(s: Section) {
  switch (s.kind) {
    case "star_track": return !!s.content?.track?.url;
    case "set_openers": case "set_closers": case "tracks": return (s.content?.tracks ?? []).length > 0;
    case "mix": return (s.content?.mixes ?? []).length > 0;
    case "transition": return !!s.content?.url;
    case "text": return !!s.content?.text?.trim();
  }
}

function InfoBar({ p, t }: { p: PublicProfile; t: T }) {
  return (
    <dl className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:mt-0 md:grid-cols-[1.4fr_1fr_1fr]">
      <div className="col-span-2 flex flex-col gap-1.5 px-4 pb-3.5 pt-3 md:col-span-1 md:px-[18px]" style={{ background: t.s2, color: t.s2fg }}>
        <dt className="font-mono text-[10px] tracking-[0.08em] md:text-[11px]">SOUND</dt>
        <dd className="text-[22px] font-extrabold leading-[1.1] tracking-[-0.025em]">{p.genres.join(" · ")}</dd>
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-3 md:px-[18px]" style={{ background: t.s1, color: t.s1fg }}>
        <dt className="font-mono text-[10px] tracking-[0.08em] md:text-[11px]">BASED</dt>
        <dd className="text-[16px] font-semibold leading-[1.2] md:text-[18px]">{p.city || "—"}</dd>
      </div>
      <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-3 md:px-[18px]" style={{ background: t.s3, color: t.s3fg }}>
        <dt className="font-mono text-[10px] tracking-[0.08em] md:text-[11px]">PLAYS</dt>
        <dd className="text-[16px] font-semibold leading-[1.2] md:text-[18px]">{p.plays.join(" · ") || "—"}</dd>
      </div>
    </dl>
  );
}

function Photo({ p, t }: { p: PublicProfile; t: T }) {
  const style = p.photo_style;
  const src = photoUrl(p.photo_path, p.look, style);
  const initials = p.display_name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <figure className="relative m-0 aspect-[4/5] overflow-hidden md:self-end" style={{ background: t.htBg }}>
      {src && style === "bw" ? (
        // eslint-disable-next-line @next/next/no-img-element -- fertiges Schwarz-Weiß-Bild aus dem Speicher
        <img src={src} alt={`${p.display_name}, black and white portrait`} className="h-full w-full object-cover" />
      ) : src ? (
        // Gespeichert ist nur das Raster als Maske; die Farben kommen aus dem Look (kein Neu-Upload bei Look-Wechsel)
        <div
          role="img"
          aria-label={`${p.display_name}, halftone portrait`}
          className="h-full w-full"
          style={{ background: t.htDot, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "cover", maskSize: "cover", WebkitMaskPosition: "center", maskPosition: "center" }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundImage: `radial-gradient(${t.htDot} 28%, transparent 30%)`, backgroundSize: "13px 13px" }}
          aria-label={`${p.display_name}, no photo`}
        >
          <span className="px-3 text-[120px] font-extrabold leading-none tracking-[-0.06em]" style={{ background: t.htBg, color: t.htDot }}>{initials}</span>
        </div>
      )}
    </figure>
  );
}

function Links({ p, t }: { p: PublicProfile; t: T }) {
  const n = p.links.length;
  return (
    <nav aria-label="Elsewhere" className="grid grid-cols-2 gap-px border-b md:mt-7 md:border-[1.5px]" style={{ background: t.fg, borderColor: t.fg, gridTemplateColumns: undefined }}>
      {p.links.map((l, i) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer me"
          className={`tint nudge flex h-[52px] items-center justify-between overflow-hidden whitespace-nowrap px-4 text-[15px] font-semibold md:h-[60px] md:px-[18px] ${i === n - 1 && n % 2 === 1 ? "col-span-2" : ""}`}
          style={{ background: t.bg, color: t.fg }}
        >
          <span className="truncate">{l.label}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true" className="nudge-arrow flex-none"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>
        </a>
      ))}
    </nav>
  );
}

function Heading({ n, title, meta, t }: { n: number; title: string; meta?: string; t: T }) {
  return (
    <h2 className="m-0 flex items-center gap-2.5 border-t-2 pt-3" style={{ borderColor: t.fg }}>
      <span className="flex h-[22px] items-center rounded-full px-2 font-mono text-[11px] font-semibold" style={{ background: t.fg, color: t.bg }}>{String(n).padStart(2, "0")}</span>
      <span className="text-[22px] font-semibold leading-none tracking-[-0.02em]">{title}</span>
      {meta && <span className="ml-auto font-mono text-[10px] font-medium tracking-[0.1em]" style={{ color: t.muted }}>{meta}</span>}
    </h2>
  );
}

function SectionBlock({ n, s, t }: { n: number; s: Section; t: T }) {
  const title = s.title || SECTION_TITLES[s.kind];
  if (s.kind === "star_track") {
    const tr = s.content.track;
    return (
      <section className="flex flex-col gap-3.5">
        <Heading n={n} title={title} meta={PROVIDER_LABEL[providerOf(tr.url)].toUpperCase()} t={t} />
        <PlayerCard id={`s${n}`} url={tr.url} title={tr.title} sub={tr.artist} big accent={t.accent} onAccent={t.onAccent} surface={t.surface} line={t.line2} muted={t.muted} />
        {s.content.note && <p className="text-[15px] leading-[1.45] md:text-[16px]">{s.content.note}</p>}
      </section>
    );
  }
  if (s.kind === "set_openers" || s.kind === "set_closers" || s.kind === "tracks") {
    const tracks = s.content.tracks;
    return (
      <section className="flex flex-col gap-3.5">
        <Heading n={n} title={title} meta={`${tracks.length} TRACK${tracks.length === 1 ? "" : "S"}`} t={t} />
        {s.content.note && <p className="text-[15px] leading-[1.45]" style={{ color: t.muted }}>{s.content.note}</p>}
        <ol className="m-0 list-none rounded-[6px] border p-0" style={{ background: t.surface, borderColor: t.line2 }}>
          {tracks.map((tr, i) => (
            <TrackRow key={i} id={`s${n}-${i}`} url={tr.url} title={tr.title} artist={tr.artist} fg={t.fg} muted={t.muted} line={t.line2} first={i === 0} />
          ))}
        </ol>
      </section>
    );
  }
  if (s.kind === "mix") {
    const mix = s.content.mixes[0];
    return (
      <section className="flex flex-col gap-3.5">
        <Heading n={n} title={title} meta={PROVIDER_LABEL[providerOf(mix.url)].toUpperCase()} t={t} />
        <PlayerCard id={`s${n}`} url={mix.url} title={mix.title} sub={mix.label} big accent={t.accent} onAccent={t.onAccent} surface={t.surface} line={t.line2} muted={t.muted} />
      </section>
    );
  }
  if (s.kind === "transition") {
    const c = s.content;
    return (
      <section className="flex flex-col gap-3.5">
        <Heading n={n} title={title} meta={PROVIDER_LABEL[providerOf(c.url)].toUpperCase()} t={t} />
        <div className="flex flex-col gap-3.5 rounded-[6px] p-4" style={{ background: t.hl, color: t.hlFg }}>
          <span className="flex items-baseline gap-2">
            <span className="text-[60px] font-extrabold leading-[0.85] tracking-[-0.055em]">{mmss(c.start)}</span>
            <span className="font-mono text-[12px] tracking-[0.04em]">→ {mmss(c.end)}</span>
          </span>
          {c.note && <span className="text-[14px] leading-[1.4]">{c.note}</span>}
        </div>
        <PlayerCard id={`s${n}`} url={c.url} title={c.title || "The full set"} sub={`Skip to ${mmss(c.start)} in the player`} startSeconds={c.start} accent={t.accent} onAccent={t.onAccent} surface={t.surface} line={t.line2} muted={t.muted} />
      </section>
    );
  }
  const text = (s.content as { text?: string }).text ?? "";
  return (
    <section className="flex flex-col gap-3.5">
      <Heading n={n} title={title} t={t} />
      <p className="text-[20px] font-medium leading-[1.3] tracking-[-0.015em]">{text}</p>
    </section>
  );
}
