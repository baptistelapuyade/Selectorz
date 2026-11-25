"use client";

import { Ended, NotFound, Revoked, Taken } from "./closed";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { joinChain, needsName } from "@/app/(build)/chain/actions";
import { LiveSheet } from "@/components/build/live-sheet";
import { track as log } from "@/components/analytics";
import { firstName, ROLE_COLOR, urlKey, type Entry, type Invite, type PageTrack } from "@/lib/chains";
import { PROVIDER_LABEL, providerOf } from "@/lib/profile";
import { Bar, ChainHeader, ChainList, Cta, LastPlayed, PlayButton, PlayFrame, PlayProvider, TrackPick, pickReady, type Pick } from "./ui";

// Einladung annehmen (CHAIN-02..04): Track 1 hören, Track 2 wählen, erst dann einloggen
export function JoinChain({ token, invite, page, loggedIn }: { token: string; invite: Invite | null; page: PageTrack[]; loggedIn: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<Pick>({ track: null, comment: "" });
  const request = useRef<string | null>(null);
  const [step, setStep] = useState<"intro" | "pick" | "login" | "name">("intro");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!invite || !invite.invite_open) return <Closed invite={invite} token={token} />;

  const host = firstName(invite.creator_name);
  const first: Entry = { position: 1, role: "A", title: invite.track_title, artist: invite.track_artist, url: invite.track_url, comment: invite.track_comment, created_at: "" };
  const taken = [urlKey(invite.track_url)];

  const join = async (n?: string) => {
    if (!pick.track) return;
    request.current ??= crypto.randomUUID();
    const r = await joinChain(token, pick.track, pick.comment, request.current, n);
    if (!r.ok) {
      if (r.code === "not_authenticated") return setStep("login");
      setStep("pick");
      return setError(r.error);
    }
    log("chain_joined", {});
    router.push(`/chain/${r.chain}`);
  };

  const send = () =>
    start(async () => {
      if (!loggedIn) return setStep("login");
      if (await needsName()) return setStep("name");
      await join();
    });

  if (step === "intro") return <Intro invite={invite} first={first} onGo={() => setStep("pick")} />;

  return (
    <PlayProvider>
      <main className="flex flex-1 flex-col">
        <ChainHeader a={invite.creator_name} b={null} right={`TRACK 2 OF ${invite.target}`} />
        <div className="mx-auto w-full max-w-[1440px] grid flex-1 gap-10 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)] md:gap-16 md:px-20 md:py-12">
          <div className="flex min-w-0 flex-col gap-5">
            <span className="label-mono text-ink-3">{host.toUpperCase()} INVITED YOU</span>
            <h1 className="text-[52px] font-extrabold leading-[0.88] tracking-[-0.06em] md:text-[84px]">Pick track 2.</h1>
            <p className="max-w-[560px] text-[17px] leading-[1.45] text-ink-2">
              Listen to {host}’s {invite.track_title}. What would you play next? One track, not a whole mix.
            </p>
            <div className="md:hidden"><LastPlayed e={first} who={host} /></div>
            <TrackPick value={pick} onChange={setPick} page={page} n={2} taken={taken} />
            {error && <p key={error} role="alert" className="shake text-[14px] text-error-text">{error}</p>}
          </div>
          <div className="hidden min-w-0 md:block">
            <ChainList title={invite.title || `${host}’s chain`} entries={[first]} target={invite.target} names={{ A: invite.creator_name, B: "You" }} mine="B" pick={2} />
          </div>
        </div>
        <Bar note={loggedIn ? "The first DJ who answers gets the spot." : "No account yet? We’ll send you a code to lock in your move."}>
          <Cta onClick={send} disabled={!pickReady(pick, taken) || pending}>{pending ? "Sending…" : "Send track 2"}</Cta>
        </Bar>
      </main>

      {step === "login" && (
        <LiveSheet
          text={{
            eyebrow: "One last thing",
            title: "Confirm your email to lock in your move.",
            intro: `${pick.track?.title ?? "Your track"} stays saved while you check. No password, just a code.`,
            action: "Lock in track 2",
            acting: "Locking in…",
            from: "chain_invite",
            legal: "No public profile needed to play. Your email is never shown.",
          }}
          error={error}
          onClose={() => setStep("pick")}
          onVerified={async () => {
            if (await needsName()) {
              setStep("name");
              return;
            }
            await join();
          }}
        />
      )}

      {step === "name" && (
        <div className="fixed inset-0 z-50 text-ink">
          <button aria-label="Close" onClick={() => !pending && setStep("pick")} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.55)] active:scale-100" />
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="name-title"
            onSubmit={(e) => {
              e.preventDefault();
              start(() => join(name));
            }}
            className="sheet absolute inset-x-0 bottom-0 flex flex-col gap-5 rounded-t-[22px] bg-bg px-4 pb-6 pt-5 md:inset-y-0 md:left-auto md:right-0 md:w-[460px] md:rounded-none md:px-9 md:py-9 md:shadow-modal"
          >
            <span className="label-mono text-ink-3">Almost there</span>
            <h2 id="name-title" className="text-[34px] font-extrabold leading-[0.95] tracking-[-0.045em]">What should {host} call you?</h2>
            <p className="text-[15px] leading-[1.45] text-ink-2">Your DJ name. {host} sees it next to your tracks.</p>
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              DJ name
              <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname"
                className="field h-14 rounded-s border border-field-border bg-surface px-4 text-[17px] font-normal outline-none focus:border-2 focus:border-ink" />
            </label>
            {error && <p role="alert" className="text-[13px] text-error-text">{error}</p>}
            <Cta type="submit" disabled={!name.trim() || pending}>{pending ? "Sending…" : "Send track 2"}</Cta>
          </form>
        </div>
      )}
    </PlayProvider>
  );
}

// Link ungültig, ersetzt, vergeben oder Runde beendet (Boards DeskErrTaken3, DeskErrRevoked, DeskErrEnded)
function Closed({ invite, token }: { invite: Invite | null; token: string }) {
  if (!invite) return <NotFound />;
  if (invite.state === "waiting_for_partner") return <Revoked invite={invite} token={token} />;
  if (invite.state === "archived" && !invite.partner_name) return <Ended name={firstName(invite.creator_name)} count={1} target={invite.target} entries={[{ role: "A" }]} />;
  return <Taken invite={invite} />;
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

// Einladung, erster Blick (Board DeskInvite): wer lädt ein, Track 1 hören, wie es geht; dann Track 2 wählen
function Intro({ invite, first, onGo }: { invite: Invite; first: Entry; onGo: () => void }) {
  const host = firstName(invite.creator_name);
  const A = ROLE_COLOR.A;
  const steps = [
    { n: "01", title: `Listen to ${host}’s track`, text: "It plays right here, from the platform it lives on." },
    { n: "02", title: "Answer with yours", text: "Paste a link to the track you’d play next. Add a line if you like." },
    { n: "03", title: "Take turns until six", text: "We let you know when it’s your turn again. Then you both get the joint selection." },
  ];
  return (
    <PlayProvider>
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 pb-14 md:px-10">
        <header className="flex h-16 items-center justify-between md:h-24">
          <Link href="/" className="text-[24px] font-extrabold leading-none tracking-[-0.045em] md:text-[38px]">Selectorz</Link>
          <span className="label-mono text-ink-3">TRACK CHAIN · INVITE</span>
        </header>
        <section className="mt-4 grid items-start gap-10 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)] md:gap-[72px]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 items-center gap-2.5 rounded-full pl-2 pr-[18px] text-[16px] font-semibold" style={{ background: A }}>
                <span aria-hidden className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink font-mono text-[10px] font-semibold" style={{ color: A }}>{initials(invite.creator_name)}</span>
                {invite.creator_name}
              </span>
              <span className="text-[17px] text-ink-2">invited you to a track chain</span>
            </div>
            <h1 className="text-[56px] font-extrabold leading-[0.86] tracking-[-0.06em] md:text-[112px]">What would you play next?</h1>
            <p className="max-w-[540px] text-[17px] leading-[1.45] text-ink-2 md:text-[19px]">
              {host} started with one record. Answer with yours, then take turns. Six tracks in total, and at the end you both get a joint selection to keep or share.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-6">
              <button type="button" onClick={onGo} className="cta flex h-16 w-full items-center justify-between rounded-full border-2 border-ink bg-ink px-[26px] text-[18px] font-semibold text-night-t1 shadow-cta sm:w-[360px]">
                Pick your track 2 <span aria-hidden className="cta-arrow">→</span>
              </button>
              <Link href="/" className="link-hover text-[15px] font-semibold underline underline-offset-[3px]">Not now</Link>
            </div>
            <p className="text-[14px] text-ink-3">No profile needed. You confirm your email when you send your track.</p>
          </div>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2.5" aria-label={`${host} picked`}>
              <span className="label-mono flex items-center gap-2 text-ink-3">
                <span className="flex h-[22px] items-center rounded-full px-2 font-semibold text-ink" style={{ background: A }}>01</span>
                {host.toUpperCase()} PICKED
              </span>
              <div className="flex flex-col rounded-[8px] border border-line bg-surface">
                <div className="flex items-center gap-4 p-[22px]">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[34px] font-extrabold leading-[0.92] tracking-[-0.04em] md:text-[44px] [overflow-wrap:anywhere]">{first.title}</span>
                    <span className="text-[15px] text-ink-3">{[first.artist, PROVIDER_LABEL[providerOf(first.url)]].filter(Boolean).join(" · ")}</span>
                  </span>
                  <PlayButton id="intro" url={first.url} title={first.title} big />
                </div>
                {first.comment && <p className="px-[22px] pb-[18px] text-[18px] leading-[1.4]">“{first.comment}”</p>}
                <div className="px-[22px] pb-3"><PlayFrame id="intro" url={first.url} title={first.title} /></div>
                <p className="border-t border-line px-[22px] py-3 font-mono text-[10px] tracking-[0.06em] text-ink-3">PRESS PLAY TO LOAD THE {PROVIDER_LABEL[providerOf(first.url)].toUpperCase()} PLAYER</p>
              </div>
            </section>
            <div className="flex flex-col gap-3.5 rounded-[8px] bg-night-bg p-[18px] text-night-t1" aria-hidden>
              <span className="flex justify-between font-mono text-[10px] tracking-[0.1em] text-night-t3"><span>THE CHAIN SO FAR</span><span>1 OF {invite.target}</span></span>
              <div className="grid grid-cols-6 items-end gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="flex flex-col gap-2">
                    <span className="rounded-[4px]" style={{ height: 40 + i * 14, background: i === 0 ? A : i === 1 ? "transparent" : "#2A2A2E", border: i === 1 ? "1.5px dashed #EDEDEA" : 0 }} />
                    <span className="font-mono text-[10px] tracking-[0.06em]" style={{ color: i < 2 ? "#EDEDEA" : "#6A6A70" }}>
                      {i === 0 ? `01 ${host.toUpperCase()}` : i === 1 ? "02 YOU" : `0${i + 1}`}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section aria-label="How it works" className="mt-auto pt-16 md:pt-[72px]">
          <ol className="grid grid-cols-1 border-t-2 border-ink md:grid-cols-3">
            {steps.map((st) => (
              <li key={st.n} className="flex flex-col gap-2 pr-6 pt-4">
                <span className="label-mono text-ink-3">{st.n}</span>
                <span className="text-[22px] font-semibold tracking-[-0.02em]">{st.title}</span>
                <span className="text-[15px] leading-[1.45] text-ink-3">{st.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PlayProvider>
  );
}
