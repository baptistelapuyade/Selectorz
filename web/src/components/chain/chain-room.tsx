"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { addTrack, endChain, getChain, renewInvite, revokeInvite } from "@/app/(build)/chain/actions";
import { track as log } from "@/components/analytics";
import { firstName, inviteUrl, ROLE_COLOR, urlKey, type Chain, type PageTrack, type Role } from "@/lib/chains";
import { inviteKey, rememberInvite } from "./start-chain";
import { Bar, ChainHeader, ChainList, Cta, InviteCard, LastPlayed, PlayProvider, Progress, TrackPick, pickReady, type Pick } from "./ui";

// Die Runde (CHAIN-05..10): dein Zug, warten, Einladung offen, fertig, beendet
export function ChainRoom({ initial, page }: { initial: Chain; page: PageTrack[] }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [pick, setPick] = useState<Pick>({ track: null, comment: "" });
  const request = useRef<string | null>(null); // fest pro Zug: Doppelklick = ein Track (CHAIN-07)
  const [error, setError] = useState<string | null>(null);
  const stored = useSyncExternalStore(noop, () => readInvite(initial.id), () => null);
  const [override, setToken] = useState<string | null | undefined>(undefined);
  const token = override === undefined ? stored : override;
  const [confirmEnd, setConfirmEnd] = useState(false);
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
  const list = <ChainList title={title} entries={c.entries} target={c.target} names={names} mine={c.my_role} pick={c.my_turn ? next : null} />;
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
        <span className="label-mono text-ink-3">{otherName.toUpperCase()} ANSWERED</span>
        <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.06em] md:text-[56px] xl:text-[68px]">Your turn. Track {next} of {c.target}.</h1>
        {last && <LastPlayed e={last} who={otherName} />}
        <h2 className="pt-2 text-[20px] font-semibold">Your answer</h2>
        <TrackPick value={pick} onChange={setPick} page={page} n={next} taken={taken} />
        {endButton}
      </>
    );
    bar = (
      <Bar note={`${otherName} sees it in their rounds. You can send the link yourself too.`}>
        <Cta onClick={send} disabled={!pickReady(pick, taken) || pending}>{pending ? "Sending…" : `Send track ${next}`}</Cta>
      </Bar>
    );
  } else if (c.state === "active") {
    body = (
      <>
        <span className="label-mono text-ink-3">{sent ? `SENT TO ${otherName.toUpperCase()} · JUST NOW` : `${otherName.toUpperCase()}’S TURN · TRACK ${next}`}</span>
        <h1 className="text-[56px] font-extrabold leading-[0.88] tracking-[-0.065em] md:text-[96px] [overflow-wrap:anywhere]">Over to {otherName}.</h1>
        <p className="text-[17px] text-ink-2">{last ? `${last.title} is in. ` : ""}{otherName} picks track {next} next.</p>
        <section className="flex flex-col gap-3 rounded-[18px] bg-surface p-5">
          <span className="flex items-center gap-2 label-mono text-ink-3"><span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[other] }} />{otherName.toUpperCase()}’S TURN · TRACK {next}</span>
          <span className="text-[15px] leading-[1.45] text-ink-2">Want to nudge {otherName}? Send this page’s link. Only the two of you can open it.</span>
          <CopyHere />
        </section>
        <span className="flex justify-between px-1"><span className="label-mono text-ink-3">THE CHAIN</span><span className="label-mono text-ink-3">{c.entries.length} OF {c.target}</span></span>
        <Progress entries={c.entries} target={c.target} />
        {endButton}
      </>
    );
    bar = (
      <Bar note="This page updates when you come back to it.">
        <Cta href="/home">Go to my rounds</Cta>
      </Bar>
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
    body = (
      <>
        <span className="label-mono text-ink-3">COMPLETE · {c.target} TRACKS</span>
        <h1 className="text-[56px] font-extrabold leading-[0.88] tracking-[-0.065em] md:text-[96px]">Six. Done.</h1>
        <p className="text-[17px] text-ink-2">You and {otherName} finished the chain. Sharing and the mix come in the next update.</p>
        <Progress entries={c.entries} target={c.target} />
      </>
    );
    bar = (
      <Bar>
        <Cta href="/home">Go to my rounds</Cta>
      </Bar>
    );
  } else {
    body = (
      <>
        <span className="label-mono text-ink-3">ENDED · {c.entries.length} OF {c.target}</span>
        <h1 className="text-[52px] font-extrabold leading-[0.88] tracking-[-0.06em] md:text-[84px]">This round ended.</h1>
        <p className="text-[17px] text-ink-2">It stays here for both of you. Nothing is public.</p>
        <Link href="/chain/new" className="link-hover self-start text-[15px] font-semibold underline underline-offset-4">Start a new chain</Link>
      </>
    );
    bar = (
      <Bar>
        <Cta href="/home">Go to my rounds</Cta>
      </Bar>
    );
  }

  return (
    <PlayProvider>
      <main className="flex flex-1 flex-col">
        <ChainHeader a={names.A || "You"} b={names.B || null} right={right} />
        <div className="grid flex-1 gap-10 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)] md:gap-16 md:px-20 md:py-12">
          <div className="flex min-w-0 flex-col gap-5">
            {body}
            {error && <p key={error} role="alert" className="shake text-[14px] text-error-text">{error}</p>}
          </div>
          <div className="min-w-0">{list}</div>
        </div>
        {bar}
      </main>
    </PlayProvider>
  );
}

function CopyHere() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
      className="h-11 self-start rounded-full border-[1.5px] border-ink px-5 text-[14px] font-semibold hover:bg-ink hover:text-night-t1"
    >
      {done ? "Copied" : "Copy link to this round"}
    </button>
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
