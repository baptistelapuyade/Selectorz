"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { joinChain, needsName } from "@/app/(build)/chain/actions";
import { LiveSheet } from "@/components/build/live-sheet";
import { track as log } from "@/components/analytics";
import { firstName, urlKey, type Entry, type Invite, type PageTrack } from "@/lib/chains";
import { Bar, ChainHeader, ChainList, Cta, LastPlayed, PlayProvider, TrackPick, pickReady, type Pick } from "./ui";

// Einladung annehmen (CHAIN-02..04): Track 1 hören, Track 2 wählen, erst dann einloggen
export function JoinChain({ token, invite, page, loggedIn }: { token: string; invite: Invite | null; page: PageTrack[]; loggedIn: boolean }) {
  const router = useRouter();
  const [pick, setPick] = useState<Pick>({ track: null, comment: "" });
  const request = useRef<string | null>(null);
  const [step, setStep] = useState<"pick" | "login" | "name">("pick");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!invite || !invite.invite_open) return <Closed invite={invite} />;

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

  return (
    <PlayProvider>
      <main className="flex flex-1 flex-col">
        <ChainHeader a={invite.creator_name} b={null} right={`TRACK 2 OF ${invite.target}`} />
        <div className="grid flex-1 gap-10 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)] md:gap-16 md:px-20 md:py-12">
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

// Link ungültig, ersetzt, vergeben oder Runde beendet
function Closed({ invite }: { invite: Invite | null }) {
  const host = invite ? firstName(invite.creator_name) : null;
  const [title, text] = !invite
    ? ["This invite doesn’t exist.", "Check the link, or ask for a new one."]
    : invite.state === "archived"
      ? ["This round ended.", `${host} ended it before track 2.`]
      : invite.state === "waiting_for_partner"
        ? ["This link doesn’t work anymore.", `${host} replaced or turned off this invite. Ask for a new link.`]
        : ["Someone else answered first.", `This round already has two DJs. Start your own and send it to ${host}.`];
  return (
    <>
    <header className="flex h-14 items-center border-b border-line px-4 md:h-[72px] md:px-10">
      <Link href="/" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[26px] md:tracking-[-0.045em]">Selectorz</Link>
    </header>
    <main className="flex flex-1 flex-col items-start gap-5 px-4 py-16 md:px-20 md:py-24">
      <span className="label-mono text-ink-3">TRACK CHAINS</span>
      <h1 className="max-w-[900px] text-[48px] font-extrabold leading-[0.9] tracking-[-0.06em] md:text-[80px]">{title}</h1>
      <p className="text-[17px] text-ink-2">{text}</p>
      <span className="flex flex-wrap gap-3 pt-2">
        <Cta href="/chain/new">Start your own chain</Cta>
        <Link href="/" className="flex h-[58px] items-center rounded-full border-[1.5px] border-ink px-6 text-[16px] font-semibold">What’s Selectorz?</Link>
      </span>
    </main>
    </>
  );
}
