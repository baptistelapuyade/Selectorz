"use client";

import Link from "next/link";
import { useState } from "react";
import { firstName, groupOf, ROLE_COLOR, roundTitle, statusLine, type Round, type RoundGroup } from "@/lib/chains";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const ago = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : d < 7 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const FILTERS: { id: "all" | RoundGroup; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting" },
  { id: "open", label: "Invite open" },
  { id: "complete", label: "Complete" },
  { id: "ended", label: "Ended" },
];

// Rounds auf Home (Board M1cHomeRounds): erst „Your turn“ groß, darunter alle Runden mit Filter
export function Rounds({ rounds }: { rounds: Round[] }) {
  const [filter, setFilter] = useState<"all" | RoundGroup>("all");
  const [more, setMore] = useState(false);
  const turn = rounds.filter((r) => groupOf(r) === "turn");
  const count = (g: RoundGroup) => rounds.filter((r) => groupOf(r) === g).length;
  const rest = rounds.filter((r) => groupOf(r) !== "turn" && (filter === "all" || groupOf(r) === filter));
  const shown = more ? rest : rest.slice(0, 7);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="rounds-title">
      <Link href="/chain/new" className="cta mt-3.5 flex h-[52px] items-center justify-between rounded-full bg-ink px-5 text-[15px] font-semibold text-night-t1 shadow-cta md:hidden">
        Start a new chain <span aria-hidden className="cta-arrow">→</span>
      </Link>
      <span className="grid grid-cols-3 gap-2 pt-3.5 md:flex md:gap-8" aria-label="Your rounds at a glance">
        {[
          [turn.length, "Your turn"],
          [count("waiting") + count("open"), "Waiting"],
          [count("complete"), "Complete"],
        ].map(([n, l]) => (
          <span key={l} className="flex flex-col">
            <span className="text-[34px] font-extrabold leading-none tracking-[-0.05em] md:text-[44px]">{n}</span>
            <span className="label-mono text-ink-3">{String(l).toUpperCase()}</span>
          </span>
        ))}
      </span>

      <span id="rounds-title" className="label-mono border-b border-ink pb-2 text-ink-3">YOUR TURN · {turn.length}</span>
      {turn.length === 0 ? (
        <p className="text-[15px] text-ink-2">Nothing waiting for you. Start a new chain or nudge someone.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {turn.map((r) => (
            <li key={r.id}>
              <Link href={`/chain/${r.id}`} className="flex flex-col gap-4 rounded-[18px] bg-night-bg p-5 text-night-t1 hover:opacity-95 md:flex-row md:items-center md:gap-6 md:p-6" data-testid="round-turn">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full font-mono text-[12px] font-semibold text-ink" style={{ background: ROLE_COLOR[r.my_role === "A" ? "B" : "A"] }}>
                    {initials(r.other?.name ?? "")}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere]">{roundTitle(r)}</span>
                    <span className="truncate text-[13px] text-night-t2">with {r.other?.name} · answered {ago(r.updated_at)}</span>
                  </span>
                </span>
                {r.last && (
                  <span className="flex min-w-0 flex-col md:w-[260px]">
                    <span className="label-mono text-night-t3">{firstName(r.other?.name ?? "").toUpperCase()} PLAYED</span>
                    <span className="truncate text-[15px]"><b className="font-semibold">{r.last.title}</b>{r.last.artist && <span className="text-night-t2"> · {r.last.artist}</span>}</span>
                  </span>
                )}
                <span className="flex h-12 flex-none items-center justify-between gap-4 rounded-full bg-night-t1 px-5 text-[15px] font-semibold text-ink">
                  Pick track {r.count + 1} <span aria-hidden>→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <span className="label-mono border-b border-ink pb-2 pt-4 text-ink-3">ALL ROUNDS</span>
      <span className="flex flex-wrap gap-1.5" role="group" aria-label="Filter rounds">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? rounds.length - turn.length : count(f.id);
          return (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold ${filter === f.id ? "bg-ink text-night-t1" : "border border-chip-border"}`}>
              {f.label} <span className="font-mono text-[10px] opacity-70">{n}</span>
            </button>
          );
        })}
      </span>
      {shown.length === 0 ? (
        <p className="text-[15px] text-ink-2">No rounds here.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((r) => (
            <li key={r.id} className="border-b border-line">
              <Link href={`/chain/${r.id}`} className="row-hover flex items-center gap-3 py-3.5 md:gap-5" data-testid="round-row">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[17px] font-semibold">{roundTitle(r)}</span>
                  <span className="truncate text-[13px] text-ink-3">{r.other ? `with ${r.other.name} · ` : ""}{ago(r.updated_at)}</span>
                </span>
                <span className="hidden grid-cols-6 gap-[3px] sm:grid" aria-hidden>
                  {Array.from({ length: r.target }, (_, i) => (
                    <span key={i} className="h-1.5 w-4 rounded-full" style={{ background: i < r.count ? ROLE_COLOR[i % 2 === 0 ? "A" : "B"] : "#D6D6D1" }} />
                  ))}
                </span>
                <span className="w-[150px] flex-none text-right text-[13px] text-ink-2 md:w-[230px]">{statusLine(r)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!more && rest.length > 7 && (
        <button type="button" onClick={() => setMore(true)} className="link-hover self-start text-[14px] font-semibold underline underline-offset-4">
          Show all {rest.length}
        </button>
      )}
    </section>
  );
}
