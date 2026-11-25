"use client";

import { useState, useTransition } from "react";
import { renewInvite, revokeInvite, startChain } from "@/app/(build)/chain/actions";
import { track as log } from "@/components/analytics";
import { inviteUrl, ROLE_COLOR, type PageTrack } from "@/lib/chains";
import { PROVIDER_LABEL } from "@/lib/profile";
import { Bar, ChainHeader, Cta, InviteCard, PlayProvider, TrackPick, pickReady, type Pick } from "./ui";

export const inviteKey = (chain: string) => `selectorz:invite:${chain}`;
export function rememberInvite(chain: string, token: string | null) {
  try {
    if (token) localStorage.setItem(inviteKey(chain), token);
    else localStorage.removeItem(inviteKey(chain));
  } catch {
    /* privater Modus: Link bleibt nur auf dieser Seite sichtbar */
  }
}

// Kette starten (CHAIN-01): Track 1 wählen, dann Einladungslink (Board DeskChainStart3)
export function StartChain({ name, page }: { name: string; page: PageTrack[] }) {
  const [pick, setPick] = useState<Pick>({ track: null, comment: "" });
  const [title, setTitle] = useState("");
  const [chain, setChain] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = pickReady(pick, []);

  const go = () =>
    start(async () => {
      if (!pick.track) return;
      const r = await startChain(pick.track, pick.comment, title);
      if (!r.ok) return setError(r.error);
      setError(null);
      setChain(r.chain);
      setToken(r.token);
      rememberInvite(r.chain, r.token);
      log("chain_started", {});
    });

  const renew = () =>
    start(async () => {
      if (!chain) return;
      const r = await renewInvite(chain);
      if (!r.ok) return setError(r.error);
      setToken(r.token);
      rememberInvite(chain, r.token);
    });
  const revoke = () =>
    start(async () => {
      if (!chain) return;
      const r = await revokeInvite(chain);
      if (!r.ok) return setError(r.error);
      setToken(null);
      rememberInvite(chain, null);
    });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <PlayProvider>
      <main className="flex flex-1 flex-col">
        <ChainHeader a={name} b={null} right={`TRACK 1 OF 6`} />
        <div className="grid flex-1 gap-10 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,600px)] md:gap-[72px] md:px-20 md:py-12">
          <div className="flex flex-col gap-6">
            <span className="label-mono text-ink-3">START A CHAIN{title ? ` · ${title.toUpperCase()}` : ""}</span>
            <h1 className="text-[52px] font-extrabold leading-[0.88] tracking-[-0.06em] md:text-[84px]">Pick track 1.<br />Send the link.</h1>
            {chain && pick.track ? (
              <section className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5" aria-label="Your track 1">
                <span className="flex h-[26px] w-10 items-center justify-center rounded-full font-mono text-[11px] font-semibold" style={{ background: ROLE_COLOR.A }}>01</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[22px] font-extrabold leading-tight tracking-[-0.035em] [overflow-wrap:anywhere]">{pick.track.title}</span>
                  <span className="text-[13px] text-ink-3">{[pick.track.artist, `found on ${PROVIDER_LABEL[pick.track.provider]}`].filter(Boolean).join(" · ")}</span>
                  {pick.comment && <span className="pt-1 text-[14px] italic text-ink-2">“{pick.comment}”</span>}
                </span>
              </section>
            ) : (
              <>
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-mono text-[12px] text-night-t1">1</span>
                  <span className="text-[20px] font-semibold">Your first track</span>
                </span>
                <TrackPick value={pick} onChange={setPick} page={page} n={1} taken={[]} />
                <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
                  <span>Name this round <span className="font-normal text-ink-3">Optional</span></span>
                  <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Slow Sunday"
                    className="field h-14 rounded-s border border-field-border bg-surface px-4 text-[16px] font-normal outline-none placeholder:text-ink-4 focus:border-2 focus:border-ink" />
                </label>
              </>
            )}
            {error && <p key={error} role="alert" className="shake text-[13px] text-error-text">{error}</p>}
          </div>
          <div className="flex flex-col gap-4 md:pt-[186px]">
            <InviteCard url={token ? inviteUrl(origin, token) : null} onRenew={chain ? renew : undefined} onRevoke={chain ? revoke : undefined} busy={pending} pending={!chain} />
          </div>
        </div>
        {chain ? (
          <Bar note={<><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: ROLE_COLOR.A }} />Track 1 is saved. Waiting for a DJ to join. The chain stays unlisted until you both decide to share it.</>}>
            <Cta href="/home">Done, go to my rounds</Cta>
          </Bar>
        ) : (
          <Bar note="Nothing is sent yet. Save track 1, then share your link.">
            <Cta onClick={go} disabled={!ready || pending}>{pending ? "Saving…" : "Save track 1 and get the link"}</Cta>
          </Bar>
        )}
      </main>
    </PlayProvider>
  );
}
