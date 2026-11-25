"use client";

import { useState, useTransition } from "react";
import { setNotify } from "@/app/(build)/chain/actions";
import { ago, firstName, ROLE_COLOR, type Chain, type Role } from "@/lib/chains";
import { copyText } from "@/lib/copy";
import { ChainList, Cta, ShareChips } from "./ui";

// Übergabe nach dem eigenen Zug (Boards DeskChainHandoff3, ChainHandoff2)
export function Handoff({ c, names, title, here, sent, handle, notify, endButton }: {
  c: Chain; names: Record<Role, string>; title: string; here: string | null; sent: boolean;
  handle: string | null; notify: boolean; endButton: React.ReactNode;
}) {
  const other: Role = c.my_role === "A" ? "B" : "A";
  const name = firstName(names[other] || "your partner");
  const NAME = name.toUpperCase();
  const next = c.entries.length + 1;
  const last = c.entries[c.entries.length - 1];
  const [chain, setChain] = useState(false);
  const eyebrow = `SENT TO ${NAME} · ${sent || !last ? "JUST NOW" : ago(last.created_at).toUpperCase()}`;
  const otherHandle = c.participants.find((p) => p.role === other)?.handle ?? null;

  return (
    <>
      <div className="mx-auto grid w-full max-w-[1440px] gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,520px)] md:gap-16 md:px-20 md:pb-10 md:pt-11">
        <div className="flex min-w-0 flex-col md:min-h-[640px] md:gap-[18px]">
          <span className="hidden label-mono text-ink-3 md:block">{eyebrow}</span>
          <div className="order-first mx-4 mt-1 md:order-none md:hidden">
            <DotChain c={c} names={names} next={next} other={other} eyebrow={eyebrow} small />
          </div>
          <h1 className="mx-4 mt-[22px] text-[46px] font-extrabold leading-[0.9] tracking-[-0.05em] [overflow-wrap:anywhere] md:mx-0 md:mt-0 md:text-[112px] md:leading-[0.84] md:tracking-[-0.065em]">Over to {name}.</h1>
          <p className="mx-4 mt-2.5 max-w-[560px] text-[15px] leading-[1.45] text-ink-2 md:mx-0 md:mt-0 md:text-[18px]">
            {last ? `${last.title} is in. ` : ""}{name} picks track {next} next.
          </p>
          <div className="mt-auto hidden pt-6 md:block">
            <DotChain c={c} names={names} next={next} other={other} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <section className="mx-4 mt-[18px] flex flex-col gap-3 rounded-[18px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(17,17,17,0.06),0_16px_40px_rgba(17,17,17,0.07)] md:mx-0 md:mt-0 md:gap-4 md:rounded-[20px] md:p-7 md:shadow-[0_1px_2px_rgba(17,17,17,0.06),0_24px_60px_rgba(17,17,17,0.08)]">
            <span className="hidden items-center gap-2.5 md:flex">
              <span aria-hidden className="ping h-2.5 w-2.5 rounded-full" style={{ background: ROLE_COLOR[other] }} />
              <span className="label-mono text-ink-3">{NAME}’S TURN · TRACK {next}</span>
            </span>
            <span className="text-[22px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px] md:leading-[0.94] md:tracking-[-0.04em]">
              We’ve emailed {name}. <span className="md:hidden">Tell {name} yourself?</span><span className="hidden md:inline">Want to tell {name} yourself?</span>
            </span>
            <LinkField url={here} />
            <ShareChips url={here} text={`Your turn in ${title}:`} grid />
          </section>
          <MailToggle initial={notify} />
          <div className="mx-4 pt-6 md:mx-0">{endButton}</div>
        </div>
      </div>
      {chain && (
        <div id="chain" className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-8 md:px-20">
          <ChainList title={title} entries={c.entries} target={c.target} names={names} mine={c.my_role} pick={null} />
        </div>
      )}
      <footer className="mt-8 border-t border-line bg-bg md:sticky md:bottom-0 md:z-10 md:mt-auto">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col-reverse gap-2.5 px-4 pb-6 pt-[18px] md:h-[104px] md:flex-row md:items-center md:justify-between md:gap-6 md:px-20 md:py-0">
          <span className="flex items-center justify-center gap-3 text-[14px] leading-[1.4] text-ink-2 md:justify-start">
            <button type="button" onClick={() => setChain((v) => !v)} aria-expanded={chain} className="link-hover font-semibold text-ink underline underline-offset-[3px]">
              {chain ? "Hide the chain" : "View the chain"}
            </button>
            {!handle && (
              <span className="hidden items-center gap-3 md:flex">
                <span className="text-ink-4">·</span>
                {otherHandle ? `You played in ${name}’s chain. Want a page like ${name}’s?` : "Want your own DJ page?"}
              </span>
            )}
          </span>
          {handle ? <Cta href="/home">Go to my rounds</Cta> : <Cta href="/start">Make your own DJ page</Cta>}
        </div>
      </footer>
    </>
  );
}

// Fortschritt als Punktmatrix: je Track eine Säule, wachsend; gespielte in Rollenfarbe, die nächste pulsiert unten
export function DotChain({ c, names, next, other, eyebrow, small }: {
  c: Chain; names: Record<Role, string>; next: number; other: Role; eyebrow?: string; small?: boolean;
}) {
  const w = small ? 3 : 5;
  const rows = small ? 8 : 9;
  const base = small ? 3 : 4;
  const n = c.target;
  const cols = n * w + (n - 1);
  const height = (i: number) => base + Math.round(((rows - base) * i) / Math.max(1, n - 1));
  const roleOf = (i: number): Role => c.entries[i]?.role ?? (i % 2 ? "B" : "A");
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let x = 0; x < cols; x++) {
      const slot = Math.floor(x / (w + 1));
      const gap = x % (w + 1) === w;
      const h = height(slot);
      const on = !gap && r >= rows - h;
      const played = slot < c.entries.length;
      const ping = !played && slot === next - 1 && r === rows - 1 && on;
      const bg = !on ? "transparent" : played || ping ? ROLE_COLOR[played ? roleOf(slot) : other] : "var(--color-night-dot)";
      cells.push(<span key={`${r}-${x}`} className={`aspect-square rounded-full ${ping ? "ping" : ""}`} style={{ background: bg }} />);
    }
  const legend = (["A", "B"] as Role[]).map((r) => (
    <span key={r} className="flex items-center gap-1.5 label-mono text-night-t2">
      <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[r] }} />
      {r === c.my_role ? "YOU" : firstName(names[r] || "?").toUpperCase()}
    </span>
  ));
  const count = <span className={`font-extrabold leading-none tracking-[-0.05em] text-night-t1 ${small ? "text-[40px] leading-[0.9]" : "text-[44px]"}`}>{c.entries.length}/{n}</span>;
  return (
    <div className={`flex flex-col bg-night-bg ${small ? "gap-3 rounded-[14px] p-4" : "gap-4 rounded-[18px] px-7 pb-[22px] pt-[26px]"}`} role="img" aria-label={`${c.entries.length} of ${n} tracks played`}>
      <span className="flex items-baseline justify-between">
        {count}
        {small ? <span className="label-mono text-night-t2">{eyebrow}</span> : <span className="flex gap-4">{legend}</span>}
      </span>
      <span aria-hidden className={`grid ${small ? "gap-[3px]" : "gap-1"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{cells}</span>
      {!small && (
        <span aria-hidden className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {Array.from({ length: n }, (_, i) => <span key={i} className="font-mono text-[10px] tracking-[0.12em] text-night-t2">{String(i + 1).padStart(2, "0")}</span>)}
        </span>
      )}
      {small && <span className="flex gap-4">{legend}</span>}
    </div>
  );
}

// Link zur Runde mit Kopieren (Board: Feld + „Copy link“, mobil „Copy“)
function LinkField({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);
  const shown = url ? url.replace(/^https?:\/\//, "") : "";
  return (
    <span className="flex items-center gap-2">
      <input readOnly value={shown} aria-label="Link to this round" onFocus={(e) => e.target.select()}
        className="h-[46px] min-w-0 flex-1 truncate rounded-s border border-surface-sunken bg-surface-sunken px-3 text-[14px] font-semibold outline-none md:h-[52px] md:px-3.5 md:text-[15px]" />
      <button type="button" disabled={!url}
        onClick={async () => {
          if (!url) return;
          if (await copyText(url)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
        className="cta h-[46px] flex-none rounded-full bg-ink px-4 text-[14px] font-semibold text-night-t1 md:h-[52px] md:px-[26px] md:text-[16px] md:shadow-cta">
        {copied ? "Copied" : <><span className="md:hidden">Copy</span><span className="hidden md:inline">Copy link</span></>}
      </button>
    </span>
  );
}

// „Email me“: dieselbe Einstellung wie in Settings (accounts.notify_email)
function MailToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const flip = () =>
    start(async () => {
      const want = !on;
      setOn(want);
      const r = await setNotify(want);
      if (!r.ok) {
        setOn(!want);
        setError(true);
      } else setError(false);
    });
  return (
    <section className="mx-4 mt-[22px] flex flex-col md:mx-0 md:mt-auto md:px-1 md:pt-8">
      <span className="label-mono border-b-2 border-ink pb-2.5 text-ink-3 md:pb-3">WHEN IT’S YOUR TURN AGAIN</span>
      <span className="flex items-center gap-3 pt-3.5 md:gap-3.5 md:pt-4">
        <span className="flex flex-1 flex-col gap-[3px]">
          <span id="mail-me" className="text-[15px] md:text-[16px] md:font-semibold">Email me</span>
          <span className="hidden text-[13px] text-ink-3 md:block">On by default. You get a link to send on too.</span>
        </span>
        <button type="button" role="switch" aria-checked={on} aria-labelledby="mail-me" disabled={pending} onClick={flip}
          className={`flex h-8 w-[52px] flex-none rounded-full p-[3px] transition-colors ${on ? "justify-end bg-ink" : "justify-start bg-field-border"}`}>
          <span className="h-[26px] w-[26px] rounded-full bg-bg" />
        </button>
      </span>
      {error && <span role="alert" className="pt-2 text-[13px] text-error-text">Couldn’t save that. Try again.</span>}
    </section>
  );
}
