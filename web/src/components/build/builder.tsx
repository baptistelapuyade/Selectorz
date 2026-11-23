"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { checkHandle, hasPage, publishProfile } from "@/app/(build)/start/actions";
import { track } from "@/components/analytics";
import { emptyDraft, missing, toPayload, type Draft, type DraftTrack, type Missing } from "@/lib/build/draft";
import { PLAYS } from "@/lib/build/genres";
import { handleProblem, suggestHandle } from "@/lib/build/handle";
import { lookTokens, PROVIDER_LABEL } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import { ACCENTS, DEFAULT_ACCENT, isAccent } from "@/lib/accents";
import { GenreSheet } from "./genre-sheet";
import { LiveView } from "./live-view";
import type { StoryData } from "./story-card";
import { LiveSheet } from "./live-sheet";
import { PhotoDialog } from "./photo-dialog";
import { TrackInput, WorksWith } from "./track-input";
import { useDraft } from "./use-draft";

const SITE = "selectorz.art";

// Profil erstellen (M1b): Link → erste Version → live. Login erst beim Live-Gehen.
export function Builder() {
  const { draft: d, update, ready, clear } = useDraft();
  const [live, setLive] = useState<StoryData | null>(null);

  // Nur beim Öffnen: Wer schon eine Seite hat, bearbeitet sie im Editor (nicht nach dem Veröffentlichen hier)
  useEffect(() => {
    hasPage()
      .then((yes) => yes && window.location.replace("/edit"))
      .catch(() => {});
  }, []);

  if (live)
    return (
      <div className="flex min-h-[calc(100dvh-32px)] flex-col">
        <Steps step={3} />
        <LiveView story={live} />
      </div>
    );
  return (
    <div className="flex min-h-[calc(100dvh-32px)] flex-col">
      <Steps step={d.step === "link" ? 1 : 2} />
      {!ready ? null : d.step === "link" ? (
        <LinkStep d={d} update={update} />
      ) : (
        <VersionStep
          d={d}
          update={update}
          onLive={(h) => {
            // Daten für die Story-Karte behalten (Fotos liegen nur hier im Browser), dann Entwurf löschen
            setLive({ handle: h, displayName: d.displayName.trim(), genres: d.genres, plays: d.plays, look: d.look, accent: d.accent, photo: d.photo });
            clear();
          }}
        />
      )}
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const names = ["Link", "First version", "Live"];
  // Eingeloggt? Dann Konto zeigen und Abmelden anbieten (PO-Feedback 23.11.: sonst kein Weg hinaus)
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? null))
      .catch(() => {});
  }, []);
  return (
    <header className="flex h-14 flex-none items-center justify-between gap-4 border-line px-4 md:h-[72px] md:border-b md:px-10">
      <Link href="/" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[26px] md:tracking-[-0.045em]">Selectorz</Link>
      <ol className="hidden gap-7 md:flex" aria-label="Steps">
        {names.map((n, i) => (
          <li key={n} aria-current={i + 1 === step ? "step" : undefined} className={`flex items-center gap-2 text-[14px] font-semibold ${i + 1 <= step ? "text-ink" : "text-ink-4"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] ${i + 1 <= step ? "bg-ink text-night-t1" : "border-[1.5px] border-field-border"}`}>{i + 1}</span>
            {n}
          </li>
        ))}
      </ol>
      <span className="flex items-center gap-3">
        <span className="label-mono text-ink-3">
          <span className="md:hidden">{step} of 3</span>
          <span className="hidden md:inline">{email ? "" : "Kept in this browser"}</span>
        </span>
        {email && (
          <>
            <span className="hidden max-w-[220px] truncate text-[13px] text-ink-3 md:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <button className="h-9 rounded-full border-[1.5px] border-ink px-4 text-[13px] font-semibold hover:bg-ink hover:text-night-t1">Log out</button>
            </form>
          </>
        )}
      </span>
    </header>
  );
}

type StepProps = { d: Draft; update: ReturnType<typeof useDraft>["update"] };

// Schritt 1: eigener Mix oder „Tracks you love“ (Startscreen v4, DeskBuildStart3, DeskBuildStartTracks)
function LinkStep({ d, update }: StepProps) {
  const [editName, setEditName] = useState(false);
  const mix = d.path === "mix";
  const tracks = d.tracks;
  const ok = tracks.some((t) => t.url && t.title.trim());

  const setTrack = (i: number) => (t: DraftTrack | null, meta?: { artist: string }) =>
    update((cur) => {
      const next = [...cur.tracks];
      if (t) next[i] = t;
      else next.splice(i, 1);
      // Uploader-Name nur beim eigenen Mix als Vorschlag für den DJ-Namen (PROFILE-10)
      const name = cur.path === "mix" && meta?.artist && !cur.nameTouched ? meta.artist : cur.displayName;
      return { tracks: next.filter(Boolean), displayName: name };
    });

  const next = () =>
    update((cur) => ({
      step: "version",
      handle: cur.handleTouched && cur.handle ? cur.handle : suggestHandle(cur.displayName),
    }));

  const switchPath = (path: Draft["path"]) => update({ ...emptyDraft(path), displayName: d.displayName, nameTouched: d.nameTouched });

  return (
    <div className="flex flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
      <Stage d={d} />
      <div className="flex flex-1 flex-col md:order-first">
        <main className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-7 md:justify-center md:px-20 md:py-10">
          <span className="label-mono hidden text-ink-3 md:block">Your DJ page · step 1 of 3</span>
          <h1 className="text-[46px] font-extrabold leading-[0.88] tracking-[-0.055em] md:text-[clamp(72px,7vw,100px)] md:leading-[0.84] md:tracking-[-0.065em]">
            {mix ? <>Start with<br />one link.</> : <>Start with<br />tracks you love.</>}
          </h1>
          <p className="max-w-[560px] text-[15px] leading-[1.45] text-ink-2 md:text-[18px]">
            {mix
              ? "Paste a mix or a track of yours. We build the first version of your page from it, you make it yours."
              : "One to three tracks by other artists, the ones you'd open a set with. They become “Set openers” on your page. Your own mix can come later."}
          </p>

          {mix ? (
            <TrackInput big label="Your SoundCloud link" placeholder="Paste your SoundCloud link" track={tracks[0] ?? null} onChange={setTrack(0)} />
          ) : (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].slice(0, Math.min(3, tracks.length + 1)).map((i) => (
                <TrackInput
                  key={i}
                  label={`Track ${i + 1}`}
                  placeholder={i === 0 ? "Paste a track you love" : "Paste another one (optional)"}
                  track={tracks[i] ?? null}
                  onChange={setTrack(i)}
                  manualSuffix={` of track ${i + 1}`}
                />
              ))}
            </div>
          )}
          <WorksWith />

          {mix ? (
            <button
              type="button"
              onClick={() => switchPath("tracks")}
              className="row-hover flex items-center gap-3 rounded-m bg-surface px-4 py-3.5 text-left"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold md:text-[16px]">No mix online yet?</span>
                <span className="text-[13px] text-ink-3 md:text-[14px]">Start with tracks you love instead.</span>
              </span>
              <span className="flex h-10 flex-none items-center gap-2 rounded-full px-4 text-[14px] font-semibold shadow-[inset_0_0_0_1.5px_#111111]">
                Start with tracks <span aria-hidden>→</span>
              </span>
            </button>
          ) : null}

          {mix ? (
            d.displayName && !editName ? (
              <span className="flex items-center gap-3 border-t border-line pt-4 text-[14px] md:text-[16px]">
                <span>Your DJ name: <b>{d.displayName}</b></span>
                <button type="button" onClick={() => setEditName(true)} className="link-hover ml-auto text-[14px] font-semibold underline underline-offset-4 md:ml-0">Change</button>
              </span>
            ) : d.displayName || editName ? (
              <NameField d={d} update={update} label="Your DJ name" />
            ) : null
          ) : (
            <NameField d={d} update={update} label="Your DJ name" />
          )}
        </main>
        <footer className="sticky bottom-0 flex flex-col gap-2.5 border-t border-line bg-bg px-4 pb-6 pt-4 md:flex-row-reverse md:items-center md:justify-between md:px-20 md:py-6">
          <button
            type="button"
            disabled={!ok}
            onClick={next}
            className="cta flex h-[58px] items-center justify-between gap-7 rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none md:px-7"
          >
            Make my page <span aria-hidden className="cta-arrow">→</span>
          </button>
          {mix ? (
            <span className="text-center text-[13px] text-ink-2 md:text-[14px]">
              Already on Selectorz? <Link href="/login?next=/home" className="link-hover font-semibold text-ink underline underline-offset-4">Log in</Link>
            </span>
          ) : (
            <button type="button" onClick={() => switchPath("mix")} className="link-hover text-center text-[14px] font-semibold underline underline-offset-4">
              I have a link after all
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function NameField({ d, update, label }: StepProps & { label: string }) {
  return (
    <label className="flex flex-col gap-2 border-t border-line pt-4 text-[14px] font-semibold md:flex-row md:items-center md:gap-3 md:text-[16px] md:font-normal">
      {label}
      <input
        value={d.displayName}
        maxLength={60}
        placeholder="How people know you"
        onChange={(e) => update({ displayName: e.target.value, nameTouched: true })}
        className="field h-12 flex-1 rounded-s border border-field-border bg-surface px-3.5 text-[16px] font-normal outline-none focus:border-2 focus:border-ink"
      />
    </label>
  );
}

// Dunkle Bühne mit der entstehenden Seite (Schritt 1). Dekoration; Inhalte stehen links.
function Stage({ d }: { d: Draft }) {
  const t = d.tracks.find((x) => x.title);
  return (
    <section aria-hidden="true" className="stage-dots relative h-[300px] overflow-hidden md:h-auto">
      <span className="label-mono absolute left-4 right-4 top-4 flex justify-between text-night-t2 md:left-10 md:right-10 md:top-9">
        <span>Your page · about a minute</span>
        <span className="hidden md:inline">Day look</span>
      </span>
      <div className="absolute left-1/2 top-12 w-[250px] -translate-x-1/2 -rotate-3 overflow-hidden rounded-l bg-day-ground text-ink shadow-[0_24px_50px_rgba(0,0,0,0.55)] md:top-[120px] md:w-[min(440px,70%)] md:-rotate-2">
        <span className="block h-[120px] md:h-[260px]" style={{ background: "#8C93FF", backgroundImage: "radial-gradient(#111 30%, transparent 32%)", backgroundSize: "9px 9px" }} />
        <span className="block truncate px-3 pb-1 pt-2.5 text-[28px] font-extrabold leading-[0.9] tracking-[-0.055em] md:px-5 md:pt-4 md:text-[54px]">
          {d.displayName || "Your name"}
        </span>
        <span className="flex h-5 items-center overflow-hidden whitespace-nowrap bg-lime px-3 font-mono text-[8px] tracking-[0.1em] md:h-[30px] md:px-5 md:text-[10px]">
          {(d.genres.length ? d.genres.join(" · ") : "Your sound").toUpperCase()}
        </span>
        <span className="flex items-center gap-2.5 px-3 py-2.5 md:gap-3.5 md:px-5 md:py-4">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink md:h-11 md:w-11">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#F3F1EC"><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
          <span className="truncate text-[12px] font-semibold md:text-[14px]">{t ? t.title : "Your mix"}</span>
        </span>
      </div>
      {t && (
        <span className="appear absolute right-4 top-10 flex h-8 rotate-[4deg] items-center gap-1.5 rounded-full bg-night-t1 px-3 text-[12px] font-semibold text-ink shadow-[0_10px_20px_rgba(0,0,0,0.4)] md:right-16 md:top-24 md:h-10 md:text-[14px]">
          <span className="h-2 w-2 rounded-full bg-orange" />
          {d.path === "mix" ? `Mix found on ${PROVIDER_LABEL[t.provider]}` : "Set openers found"}
        </span>
      )}
      <span className="absolute bottom-9 left-10 right-10 hidden items-baseline justify-between text-night-t1 md:flex">
        <span className="text-[28px] font-extrabold leading-none tracking-[-0.04em]">{d.path === "mix" ? "One link in, a page out." : "Tracks in, a page out."}</span>
        <span className="label-mono text-night-t2">Link → first version → live</span>
      </span>
    </section>
  );
}

type HandleState = "idle" | "checking" | "free" | "taken" | "invalid" | "unknown";

const MISSING_TEXT: Record<Missing, string> = {
  photo: "a photo",
  sound: "your sound",
  name: "your DJ name",
  handle: "a page address",
  track: "a track",
};

function missingMessage(m: Missing[]) {
  const parts = m.map((x) => MISSING_TEXT[x]);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Add ${list} first.`;
}

// Schritt 2: erste Version mit Pflichtfeldern in der Vorschau (DeskBuildPreview2, BuildGenre2, DeskBuildPhoto)
function VersionStep({ d, update, onLive }: StepProps & { onLive: (handle: string) => void }) {
  const [hs, setHs] = useState<HandleState>("idle");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const t = lookTokens(d.look, d.accent);
  const problem = d.handle ? handleProblem(d.handle) : null;
  const miss = missing(d);

  // Handle beim Tippen prüfen (PROFILE-01): erst Format, dann frei/vergeben beim Server
  useEffect(() => {
    if (!d.handle || problem) return;
    const n = ++seq.current;
    const id = setTimeout(async () => {
      setHs("checking");
      const free = await checkHandle(d.handle);
      if (n === seq.current) setHs(free === null ? "unknown" : free ? "free" : "taken");
    }, 300);
    return () => clearTimeout(id);
  }, [d.handle, problem]);
  const handleState: HandleState = !d.handle ? "idle" : problem ? "invalid" : hs;

  const publish = async () => {
    setLiveError(null);
    const form = new FormData();
    form.set("payload", JSON.stringify(toPayload(d)));
    const blob = async (url: string) => (await fetch(url)).blob();
    const ph = d.photo!;
    if (ph.style === "bw") form.set("photo_bw", await blob(ph.bw));
    else {
      form.set("photo_day", await blob(ph.day));
      form.set("photo_night", await blob(ph.night));
    }
    const r = await publishProfile(form);
    if (r.ok) {
      track("profile_published", { path: d.path, look: d.look, genres: d.genres.length });
      onLive(r.handle);
      return;
    }
    if (r.code === "not_authenticated") return setLiveOpen(true);
    if (r.code === "handle_taken" || r.code === "invalid_handle") {
      setLiveOpen(false);
      setHs("taken");
      setError(r.error);
      return;
    }
    setLiveError(r.error);
    setError(r.error);
  };

  const save = () => {
    setTried(true);
    if (miss.length) return setError(missingMessage(miss));
    if (handleState === "taken") return setError("That page address is already taken. Pick another one.");
    setError(null);
    start(async () => {
      const { data } = await createClient().auth.getSession().catch(() => ({ data: { session: null } }));
      if (data.session) await publish();
      else setLiveOpen(true);
    });
  };

  const need = (m: Missing) => (miss.includes(m) ? (tried ? "need-fixed" : "need") : "");
  const section = d.tracks.filter((x) => x.title.trim());

  return (
    <>
      <main className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-10 pt-6 md:grid-cols-[420px_minmax(0,1fr)] md:gap-20 md:px-20 md:pt-11">
        <div className="flex flex-col gap-4">
          <button type="button" onClick={() => update({ step: "link" })} className="link-hover self-start text-[13px] font-semibold underline underline-offset-4">← Back to your link</button>
          <span className="label-mono hidden text-ink-3 md:block">Step 2</span>
          <h1 className="text-[40px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[72px] md:leading-[0.88] md:tracking-[-0.055em]">Here&apos;s your first version.</h1>
          <p className="text-[15px] leading-[1.45] text-ink-2 md:text-[17px]">Add a photo and your sound. Everything else can wait.</p>

          <label className="mt-2 flex flex-col gap-2 text-[14px] font-semibold">
            DJ name
            <input
              value={d.displayName}
              maxLength={60}
              onChange={(e) => update((cur) => ({ displayName: e.target.value, nameTouched: true, handle: cur.handleTouched ? cur.handle : suggestHandle(e.target.value) }))}
              className={`field h-[54px] rounded-s border border-field-border bg-surface px-4 text-[16px] font-normal outline-none focus:border-2 focus:border-ink ${need("name")}`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <label htmlFor="handle" className="text-[14px] font-semibold">Your page address</label>
            <span className={`field flex h-[54px] items-center rounded-s border border-field-border bg-surface pl-4 focus-within:border-2 focus-within:border-ink ${need("handle")}`}>
              <span className="text-[16px] text-ink-3">{SITE}/</span>
              <input
                id="handle"
                value={d.handle}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => update({ handle: e.target.value.toLowerCase(), handleTouched: true })}
                className="h-full min-w-0 flex-1 bg-transparent pr-4 text-[16px] outline-none"
              />
            </span>
            <span aria-live="polite" className="min-h-[18px] text-[13px]">
              {handleState === "free" && <span className="text-ok">Available</span>}
              {handleState === "checking" && <span className="text-ink-3">Checking…</span>}
              {handleState === "taken" && <span className="text-error-text">That one is already taken. Try another.</span>}
              {handleState === "invalid" && <span className="text-error-text">{problem}</span>}
              {handleState === "unknown" && <span className="text-ink-3">We&apos;ll check this one when you go live.</span>}
              {handleState === "idle" && <span className="text-ink-3">This is the link for your bio. It can&apos;t change after you go live.</span>}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold" id="look-label">Look</span>
            <span role="radiogroup" aria-labelledby="look-label" className="grid grid-cols-2 rounded-full bg-[rgba(17,17,17,0.08)] p-1">
              {(["day", "night"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={d.look === l}
                  onClick={() => update((cur) => ({ look: l, accent: isAccent(l, cur.accent) ? cur.accent : DEFAULT_ACCENT[l] }))}
                  className={`flex h-11 items-center justify-center gap-2 rounded-full text-[15px] font-semibold ${d.look === l ? "bg-ink text-night-t1" : "hover:bg-[rgba(17,17,17,0.06)]"}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l === "day" ? "#E4F45A" : "#F0532A" }} />
                  {l === "day" ? "Day" : "Night"}
                </button>
              ))}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold" id="colour-label">Accent colour</span>
              <span className="text-[12px] text-ink-3">For your photo and a few highlights. The page itself stays {d.look === "day" ? "Day" : "Night"}.</span>
            </span>
            <span role="radiogroup" aria-labelledby="colour-label" className="flex flex-wrap gap-2.5">
              {ACCENTS[d.look].map((a) => (
                <button
                  key={a.hex}
                  type="button"
                  role="radio"
                  aria-checked={d.accent === a.hex}
                  aria-label={a.name}
                  title={a.name}
                  onClick={() => update({ accent: a.hex })}
                  className={`pop h-10 w-10 rounded-full ${d.accent === a.hex ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`}
                  style={{ background: a.hex }}
                />
              ))}
            </span>
          </div>
        </div>

        <section className="flex flex-col gap-5 rounded-xl bg-surface p-4 md:p-7" aria-label="Preview">
          <span className="label-mono flex justify-between text-ink-3"><span>Preview</span><span>{d.look} look</span></span>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              aria-label={d.photo ? "Change photo" : "Add your photo"}
              className={`relative flex aspect-[4/5] w-[150px] flex-none flex-col items-center justify-center gap-1.5 overflow-hidden rounded-l bg-bg text-[14px] font-semibold ${need("photo")}`}
              style={d.photo ? { background: t.htBg } : undefined}
            >
              {d.photo?.style === "bw" ? (
                <span className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${d.photo.bw})` }} />
              ) : d.photo ? (
                <span
                  className="absolute inset-0"
                  style={{
                    background: t.htDot,
                    WebkitMaskImage: `url(${d.look === "night" ? d.photo.night : d.photo.day})`,
                    maskImage: `url(${d.look === "night" ? d.photo.night : d.photo.day})`,
                    WebkitMaskSize: "100% 100%",
                    maskSize: "100% 100%",
                  }}
                />
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                  Add photo
                  <span className="text-[11px] font-normal text-ink-3">Required</span>
                </>
              )}
            </button>
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[44px] font-extrabold [overflow-wrap:anywhere] leading-[0.88] tracking-[-0.055em] md:text-[64px]">{d.displayName || "Your name"}</span>
              <span className="truncate text-[15px] text-ink-3">{SITE}/{d.handle || "…"}</span>
            </span>
          </div>

          <ul>
            <Row label="Sound" hint="Required">
              {d.genres.length ? (
                <button type="button" onClick={() => setGenreOpen(true)} className="link-hover text-left text-[14px] font-semibold" aria-label={`Change your sound: ${d.genres.join(", ")}`}>
                  {d.genres.join(" · ")}
                </button>
              ) : (
                <button type="button" onClick={() => setGenreOpen(true)} className={`d1 inline-flex h-9 items-center rounded-full bg-bg px-3.5 text-[14px] font-semibold hover:bg-line-soft ${need("sound")}`}>
                  + Add your sound
                </button>
              )}
            </Row>
            <Row label="Photo" hint="Required">
              <button type="button" onClick={() => setPhotoOpen(true)} className="link-hover text-left text-[14px] text-ink-2">
                {d.photo ? "Added. Change it" : "Tap the square above"}
              </button>
            </Row>
            <Row label="Based" hint="Optional">
              <input
                aria-label="Based"
                value={d.city}
                maxLength={60}
                placeholder="+ Add your city"
                onChange={(e) => update({ city: e.target.value })}
                className="h-9 w-full min-w-0 rounded-[8px] bg-transparent px-2 text-[14px] outline-none placeholder:text-ink-2 hover:bg-bg focus:bg-bg"
              />
            </Row>
            <Row label="Plays" hint="Optional">
              <span className="flex flex-wrap gap-1.5">
                {PLAYS.map((p) => {
                  const on = d.plays.includes(p);
                  return (
                    <label key={p} className={`flex h-8 cursor-pointer items-center rounded-full px-3 text-[13px] font-semibold ${on ? "bg-ink text-night-t1" : "chip border-[1.2px] border-chip-border"}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => update((cur) => ({ plays: on ? cur.plays.filter((x) => x !== p) : [...cur.plays, p].slice(0, 3) }))}
                      />
                      {p}
                    </label>
                  );
                })}
              </span>
            </Row>
            <Row label={d.path === "mix" ? "Mix" : "Openers"} hint={d.path === "mix" ? "From your link" : `${section.length} of 3`}>
              <span className="flex min-w-0 flex-col">
                {section.map((x) => (
                  <span key={x.url} className="truncate text-[14px] font-semibold">
                    {x.title} <span className="font-normal text-ink-3">· {PROVIDER_LABEL[x.provider]}</span>
                  </span>
                ))}
              </span>
            </Row>
          </ul>
        </section>
      </main>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-bg px-4 pb-6 pt-4 md:flex-row md:items-center md:justify-between md:px-20 md:py-6">
        {error ? (
          <p key={error} role="alert" className="shake text-[14px] font-semibold text-error-text">{error}</p>
        ) : (
          <span className="text-[13px] leading-[1.4] text-ink-2 md:text-[14px]">Photo and sound are required. Everything else is optional.</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="cta flex h-[58px] flex-none items-center justify-between gap-7 rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none md:px-7"
        >
          {pending ? "Saving…" : "Save my page"} <span aria-hidden className="cta-arrow">→</span>
        </button>
      </footer>

      {photoOpen && (
        <PhotoDialog
          look={d.look}
          tint={t.htBg}
          dots={t.htDot}
          start={d.photo?.style}
          onUse={(photo) => update({ photo })}
          onClose={() => setPhotoOpen(false)}
        />
      )}
      {genreOpen && <GenreSheet value={d.genres} onDone={(genres) => update({ genres })} onClose={() => setGenreOpen(false)} />}
      {liveOpen && <LiveSheet error={liveError} onVerified={publish} onClose={() => setLiveOpen(false)} />}
    </>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <li className="flex min-h-[60px] items-center gap-3 border-t border-line-soft py-2 md:gap-4">
      <span className="label-mono w-[62px] flex-none text-ink-3 md:w-[70px]">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className={`flex-none text-[12px] text-ink-3 ${hint === "Required" ? "font-semibold" : ""}`}>{hint}</span>
    </li>
  );
}
