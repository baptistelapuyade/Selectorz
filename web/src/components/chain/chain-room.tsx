"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { addTrack, endChain, getChain, renewInvite, revokeInvite } from "@/app/(build)/chain/actions";
import { track as log } from "@/components/analytics";
import { ago, firstName, inviteUrl, urlKey, type Chain, type PageTrack, type Role } from "@/lib/chains";
import { Complete } from "./complete";
import { Ended } from "./closed";
import { Handoff } from "./handoff";
import { inviteKey, rememberInvite } from "./start-chain";
import { Bar, ChainHeader, ChainList, Cta, InviteCard, LastPlayed, PlayProvider, TrackPick, pickReady, type Pick } from "./ui";

// Die Runde (CHAIN-05..10): dein Zug, warten, Einladung offen, fertig, beendet
export function ChainRoom({ initial, page, handle = null, notify = true }: { initial: Chain; page: PageTrack[]; handle?: string | null; notify?: boolean }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [pick, setPick] = useState<Pick>({ track: null, comment: "" });
  const request = useRef<string | null>(null); // fest pro Zug: Doppelklick = ein Track (CHAIN-07)
  const [error, setError] = useState<string | null>(null);
  const stored = useSyncExternalStore(noop, () => readInvite(initial.id), () => null);
  const [override, setToken] = useState<string | null | undefined>(undefined);
  const token = override === undefined ? stored : override;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const here = useSyncExternalStore(noop, () => window.location.href, () => null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const names = useMemo(() => {
    const n: Record<Role, string> = { A: "", B: "" };
    for (const p of c.participants) n[p.role] = p.name;
    return n;
  }, [c.participants]);
  const other: Role = c.my_role === "A" ? "B" : "A";
  const otherName = firstName(names[other] || "your partner");
  const taken = c.entries.map((e) => urlKey(e.url));
  const next = c.entries.length + 1;
  const last = c.entries[c.entries.length - 1];
  const title = c.title || (names[other] ? `With ${otherName}` : "New round");

  // Neuer Stand, wenn das Fenster zurückkommt (die andere Person hat vielleicht gespielt)
  useEffect(() => {
    const onFocus = () => {
      if (pending) return;
      getChain(c.id).then((r) => r.ok && r.chain.version !== c.version && setC(r.chain));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [c.id, c.version, pending]);

  const send = () =>
    start(async () => {
      if (!pick.track) return;
      request.current ??= crypto.randomUUID();
      const r = await addTrack(c.id, next, pick.track, pick.comment, request.current);
      if (!r.ok) {
        setError(r.error);
        const now = (r as { chain?: Chain }).chain;
        if (now) setC(now);
        if (r.code === "stale" || r.code === "not_your_turn" || r.code === "chain_not_active") request.current = null;
        return;
      }
      setError(null);
      setC(r.chain);
      setPick({ track: null, comment: "" });
      request.current = null;
      setSent(true);
      log("chain_track_added", { position: next });
      router.refresh();
    });

  const end = () =>
    start(async () => {
      const r = await endChain(c.id);
      if (!r.ok) return setError(r.error);
      setC(r.chain);
      setConfirmEnd(false);
      rememberInvite(c.id, null);
    });
  const renew = () =>
    start(async () => {
      const r = await renewInvite(c.id);
      if (!r.ok) return setError(r.error);
      setToken(r.token);
      rememberInvite(c.id, r.token);
    });
  const revoke = () =>
    start(async () => {
      const r = await revokeInvite(c.id);
      if (!r.ok) return setError(r.error);
      setToken(null);
      rememberInvite(c.id, null);
    });

  const right = c.state === "active" ? `TRACK ${Math.min(next, c.target)} OF ${c.target}` : title.toUpperCase();
  const note = c.my_turn && last && last.role === other ? `${otherName}’s ${last.title} plays here or on the left. One player at a time.` : undefined;
  const list = <ChainList title={title} entries={c.entries} target={c.target} names={names} mine={c.my_role} pick={c.my_turn ? next : null} note={note} />;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const canEnd = c.state === "active" || c.state === "waiting_for_partner";

  const endButton = canEnd && (
    confirmEnd ? (
      <span className="flex flex-wrap items-center gap-3 text-[14px]" role="group" aria-label="End this round?">
        <span className="text-ink-2">End it for both of you? You can’t undo this.</span>
        <button type="button" disabled={pending} onClick={end} className="h-11 rounded-full bg-error-text px-5 font-semibold text-white">End round</button>
        <button type="button" onClick={() => setConfirmEnd(false)} className="link-hover font-semibold underline underline-offset-4">Keep playing</button>
      </span>
    ) : (
      <button type="button" onClick={() => setConfirmEnd(true)} className="link-hover self-start text-[14px] font-semibold text-ink-2 underline underline-offset-4">End this round</button>
    )
  );

  let body: React.ReactNode;
  let bar: React.ReactNode = null;

  if (c.state === "active" && c.my_turn) {
    body = (
      <>
        <span className="label-mono hidden text-ink-3 md:block">{last ? `${otherName.toUpperCase()} ANSWERED · ${ago(last.created_at).toUpperCase()}` : `${otherName.toUpperCase()} ANSWERED`}</span>
        <h1 className="mt-1 text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:mt-0 md:text-[56px] md:tracking-[-0.06em] xl:text-[68px]">
          <span className="md:hidden">Pick track {next}</span><span className="hidden md:inline">Your turn. Track {next} of {c.target}.</span>
        </h1>
        {last && <LastPlayed e={last} who={otherName} />}
        <h2 className="hidden pt-2 text-[20px] font-semibold md:block">Your answer</h2>
        <TrackPick value={pick} onChange={setPick} page={page} n={next} taken={taken} />
        {endButton}
      </>
    );
    bar = (
      <Bar noteBelow note={`We email ${otherName} when it’s in. You can send the link yourself too.`}>
        <Cta onClick={send} disabled={!pickReady(pick, taken) || pending}>{pending ? "Sending…" : `Send track ${next}`}</Cta>
      </Bar>
    );
  } else if (c.state === "active") {
    return (
      <PlayProvider>
        <main className="flex flex-1 flex-col">
          <ChainHeader a={names.A || "You"} b={names.B || null} right={title.toUpperCase()} />
          <Handoff c={c} names={names} title={title} here={here} sent={sent} handle={handle} notify={notify} endButton={endButton} error={error} />
        </main>
      </PlayProvider>
    );
  } else if (c.state === "waiting_for_partner") {
    body = (
      <>
        <span className="label-mono text-ink-3">INVITE OPEN</span>
        <h1 className="text-[52px] font-extrabold leading-[0.88] tracking-[-0.06em] md:text-[84px]">Waiting for track 2.</h1>
        <p className="text-[17px] text-ink-2">Track 1 is in. The first DJ who opens your link and answers gets the spot.</p>
        {c.invite_open || token ? (
          <InviteCard url={token ? inviteUrl(origin, token) : null} onRenew={renew} onRevoke={revoke} busy={pending} />
        ) : (
          <InviteCard url={null} onRenew={renew} onRevoke={revoke} busy={pending} title="Your link is off." />
        )}
        {endButton}
      </>
    );
    bar = (
      <Bar>
        <Cta href="/home">Go to my rounds</Cta>
      </Bar>
    );
  } else if (c.state === "completed") {
    return (
      <PlayProvider>
        <main className="flex flex-1 flex-col">
          <ChainHeader a={names.A || "You"} b={names.B || null} right={c.public ? "PUBLIC" : "COMPLETE"} rightMobile={`${c.entries.length} OF ${c.target} · ${c.public ? "PUBLIC" : "COMPLETE"}`} />
          <Complete c={c} onChange={setC} />
        </main>
      </PlayProvider>
    );
  } else {
    return <Ended name={c.ended_by_me ? null : otherName} count={c.entries.length} target={c.target} entries={c.entries} />;
  }

  return (
    <PlayProvider>
      <main className="flex flex-1 flex-col">
        <ChainHeader a={names.A || "You"} b={names.B || null} right={right} mobileTitle={c.state === "active" && c.my_turn ? "Your turn" : undefined} />
        <div className={`mx-auto w-full max-w-[1440px] grid flex-1 gap-10 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)] ${c.state === "active" && c.my_turn ? "pb-8 pt-1" : "py-8"} md:gap-16 md:px-20 md:py-12`}>
          <div className="flex min-w-0 flex-col gap-5">
            {body}
            {error && <p key={error} role="alert" className="shake text-[14px] text-error-text">{error}</p>}
          </div>
          <div className={`min-w-0 ${c.state === "active" && c.my_turn ? "hidden md:block" : ""}`}>{list}</div>
        </div>
        {bar}
      </main>
    </PlayProvider>
  );
}

const noop = () => () => {};
function readInvite(id: string): string | null {
  try {
    return localStorage.getItem(inviteKey(id));
  } catch {
    return null;
  }
}
