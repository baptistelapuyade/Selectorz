"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlayButton, PlayFrame, PlayProvider } from "@/components/chain/ui";
import { ago, firstName, groupOf, ROLE_COLOR, roundTitle, statusLine, type Role, type Round } from "@/lib/chains";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const other = (r: Round): Role => (r.my_role === "A" ? "B" : "A");
const otherColor = (r: Round) => r.other?.color ?? ROLE_COLOR[other(r)];
const roleColor = (r: Round, role: Role) => (role === r.my_role ? r.my_color ?? ROLE_COLOR[role] : otherColor(r));
const short = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return "NOW";
  if (h < 24) return `${Math.floor(h)} H`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 DAY" : `${d} DAYS`;
};

const Avatar = ({ r, size = 32 }: { r: Round; size?: number }) => (
  <span className="flex flex-none items-center justify-center rounded-full font-mono text-[11px] font-semibold text-ink" style={{ width: size, height: size, background: otherColor(r) }} aria-hidden>
    {initials(r.other?.name ?? "")}
  </span>
);

// Zahlen neben „Hi Luma.“ (Board M1cHomeRounds)
export function RoundStats({ rounds }: { rounds: Round[] }) {
  const n = (g: string[]) => rounds.filter((r) => g.includes(groupOf(r))).length;
  const stats: [number, string][] = [[n(["turn"]), "YOUR TURN"], [n(["waiting", "open"]), "WAITING"], [n(["complete"]), "COMPLETE"]];
  return (
    <span className="flex" aria-label="Your rounds at a glance">
      {stats.map(([v, l]) => (
        <span key={l} className="flex min-w-[88px] flex-col gap-1.5 border-l border-field-border px-4 py-0.5 first:border-l-0 first:pl-0 md:min-w-[104px] md:px-7 md:first:border-l md:first:pl-7">
          <span className="text-[32px] font-extrabold leading-none tracking-[-0.04em] md:text-[40px]">{v}</span>
          <span className="label-mono text-ink-3">{l}</span>
        </span>
      ))}
    </span>
  );
}

// Rounds auf Home (Board M1cHomeRounds): erst „Your turn“ groß, weitere Züge kompakt, dann alle Runden als Tabelle
export function Rounds({ rounds }: { rounds: Round[] }) {
  const turn = rounds.filter((r) => groupOf(r) === "turn");
  const [moreTurns, setMoreTurns] = useState(false);
  const [first, ...others] = turn;
  const shownTurns = moreTurns ? others : others.slice(0, 2);

  return (
    <PlayProvider>
      <section className="flex flex-col gap-4" aria-labelledby="rounds-title">
        <Link href="/chain/new" className="cta mt-3.5 flex h-[52px] items-center justify-between rounded-full bg-ink px-5 text-[15px] font-semibold text-night-t1 shadow-cta md:hidden">
          Start a new chain <span aria-hidden className="cta-arrow">→</span>
        </Link>
        <span className="flex justify-between pt-3">
          <span id="rounds-title" className="label-mono text-ink-3">YOUR TURN · {turn.length}</span>
          <span className="label-mono text-ink-3">NEWEST FIRST</span>
        </span>
        {!first ? (
          <p className="rounded-[18px] border border-dashed border-field-border px-5 py-4 text-[15px] text-ink-2">Nothing waiting for you. Start a new chain or nudge someone.</p>
        ) : (
          <TurnCard r={first} />
        )}
        {others.length > 0 && (
          <section className="overflow-hidden rounded-[20px] bg-night-bg" aria-label="More rounds where it’s your turn">
            <ul>
              {shownTurns.map((r) => (
                <li key={r.id} className="border-t border-night-line first:border-t-0">
                  <Link href={`/chain/${r.id}`} data-testid="round-turn"
                    className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-[#141416] md:h-[68px] md:grid-cols-[36px_220px_minmax(0,1fr)_120px_auto] md:gap-4 md:py-0 md:pl-6 md:pr-5">
                    <Avatar r={r} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[17px] font-bold text-night-t1">{roundTitle(r)}</span>
                      <span className="truncate text-[13px] text-night-t2">with {r.other?.name}</span>
                    </span>
                    <span className="hidden truncate text-[14px] text-night-t2 md:block">
                      {r.last && <>{firstName(r.other?.name ?? "")} played <span className="text-night-t1">{r.last.title}</span></>}
                    </span>
                    <span className="label-mono hidden text-night-t2 md:block">{short(r.updated_at)}</span>
                    <span className="flex h-10 items-center gap-2.5 whitespace-nowrap rounded-full bg-bg px-4 text-[14px] font-semibold text-ink">Pick track {r.count + 1} <span aria-hidden>→</span></span>
                  </Link>
                </li>
              ))}
            </ul>
            {others.length > 2 && (
              <button type="button" aria-expanded={moreTurns} onClick={() => setMoreTurns((v) => !v)}
                className="flex h-14 w-full items-center gap-3 border-t border-night-line bg-[#141416] px-6 text-[15px] font-semibold text-night-t1">
                <span className="flex pl-1.5" aria-hidden>
                  {others.slice(2, 7).map((r) => <span key={r.id} className="-ml-1.5 h-[22px] w-[22px] rounded-full border-2 border-[#141416]" style={{ background: otherColor(r) }} />)}
                </span>
                {moreTurns ? "Show fewer" : `${others.length - 2} more waiting for you`}
                <span className="ml-auto flex items-center gap-2 text-night-t2">
                  {moreTurns ? "Hide" : "Show all"}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className={moreTurns ? "rotate-180" : ""}><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </button>
            )}
          </section>
        )}
        <AllRounds rounds={rounds.filter((r) => groupOf(r) !== "turn")} />
      </section>
    </PlayProvider>
  );
}

// Erster Zug groß: letzter Track der anderen Person abspielbar, Fortschritt und „Pick track N“
function TurnCard({ r }: { r: Round }) {
  const next = r.count + 1;
  const oc = otherColor(r);
  return (
    <article className="grid gap-6 rounded-[20px] bg-night-bg p-5 text-night-t1 md:grid-cols-[minmax(0,1fr)_280px] md:items-center md:gap-7 md:px-7 md:py-[26px]" data-testid="round-turn">
      <span className="flex min-w-0 flex-col gap-3.5">
        <span className="flex items-center gap-3">
          <Avatar r={r} size={40} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <Link href={`/chain/${r.id}`} className="text-[24px] font-extrabold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere] hover:underline md:text-[28px]">{roundTitle(r)}</Link>
            <span className="truncate text-[14px] text-night-t2">with {r.other?.name} · answered {ago(r.updated_at)}</span>
          </span>
        </span>
        {r.last && (
          <span className="flex flex-col rounded-[12px] bg-night-surface px-3.5 py-3">
            <span className="flex items-center gap-3.5">
              <span className="flex h-6 flex-none items-center rounded-full px-2 font-mono text-[11px] font-semibold text-ink" style={{ background: oc }}>{String(r.last.position ?? r.count).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="truncate text-[16px] font-semibold">{r.last.title}{r.last.artist && <span className="font-normal text-night-t2"> · {r.last.artist}</span>}</span>
                {r.last.comment && <span className="truncate text-[13px] italic text-night-t2">“{r.last.comment}”</span>}
              </span>
              {r.last.url && <PlayButton id={`home-${r.id}`} url={r.last.url} title={r.last.title} dark fill={oc} />}
            </span>
            {r.last.url && <PlayFrame id={`home-${r.id}`} url={r.last.url} title={r.last.title} />}
          </span>
        )}
      </span>
      <span className="flex flex-col gap-3.5">
        <span className="label-mono text-night-t2">TRACK {next} OF {r.target}</span>
        <span className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${r.target}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length: r.target }, (_, i) => {
            const role: Role = i % 2 ? "B" : "A";
            return <span key={i} className={`h-2 rounded-full ${i === r.count ? "ping" : ""}`} style={{ background: i <= r.count ? roleColor(r, role) : "#34343A" }} />;
          })}
        </span>
        <Link href={`/chain/${r.id}`} className="cta flex h-14 items-center justify-between rounded-full bg-bg px-6 text-[16px] font-semibold text-ink shadow-cta">
          Pick track {next} <span aria-hidden className="cta-arrow">→</span>
        </Link>
      </span>
    </article>
  );
}

type Main = "waiting" | "complete" | "all";
type Sub = "all" | "yes" | "public" | "private";
const pub = (r: Round): Exclude<Sub, "all"> => (r.public ? "public" : !r.my_yes ? "yes" : "private");

// Alle Runden: Filter, Suche, Sortierung, Tabelle (Selection, With, Tracks, Status, Aktion)
function AllRounds({ rounds }: { rounds: Round[] }) {
  const complete = rounds.filter((r) => groupOf(r) === "complete");
  const waiting = rounds.filter((r) => ["waiting", "open"].includes(groupOf(r)));
  const [main, setMain] = useState<Main>(complete.length ? "complete" : "all");
  const [sub, setSub] = useState<Sub>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "az">("new");

  const list = useMemo(() => {
    let l = main === "complete" ? complete : main === "waiting" ? waiting : rounds;
    if (main === "complete" && sub !== "all") l = l.filter((r) => pub(r) === sub);
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((r) => [roundTitle(r), r.other?.name ?? "", r.last?.title ?? "", r.last?.artist ?? ""].some((x) => x.toLowerCase().includes(s)));
    const out = l.slice();
    if (sort === "old") out.reverse();
    if (sort === "az") out.sort((a, b) => roundTitle(a).localeCompare(roundTitle(b)));
    return out;
  }, [rounds, complete, waiting, main, sub, q, sort]);

  const subs: [Sub, string, number][] = [
    ["all", "All", complete.length],
    ["yes", "Needs a yes", complete.filter((r) => pub(r) === "yes").length],
    ["public", "Public", complete.filter((r) => pub(r) === "public").length],
    ["private", "Private", complete.filter((r) => pub(r) === "private").length],
  ];
  const cols = "md:grid-cols-[240px_190px_76px_140px_minmax(0,1fr)]";

  return (
    <>
      <span className="label-mono mt-5 text-ink-3">ALL ROUNDS</span>
      <section className="overflow-hidden rounded-[18px] bg-surface" aria-label="All rounds">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 md:px-5">
          <span className="flex rounded-full bg-[#F0F0EC] p-1" role="group" aria-label="Filter rounds">
            {([["waiting", "Waiting", waiting.length], ["complete", "Complete", complete.length], ["all", "All", rounds.length]] as [Main, string, number][]).map(([id, l, n]) => (
              <button key={id} type="button" aria-pressed={main === id} onClick={() => { setMain(id); setSub("all"); }}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold ${main === id ? "bg-ink text-night-t1" : ""}`}>
                {l} <span className="font-mono text-[10px] opacity-75">{n}</span>
              </button>
            ))}
          </span>
          <label className="flex h-10 w-full items-center gap-2.5 rounded-full bg-[#F0F0EC] px-3.5 text-[14px] md:ml-auto md:w-[260px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="flex-none text-ink-2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, DJ or track" aria-label="Search rounds" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#6A6A6E]" />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort rounds"
            className="h-10 rounded-full border-[1.2px] border-chip-border bg-surface px-3.5 text-[13px] font-semibold">
            <option value="new">Latest first</option>
            <option value="old">Oldest first</option>
            <option value="az">A to Z</option>
          </select>
        </div>
        {main === "complete" && (
          <div className="flex flex-wrap gap-2 px-4 pb-3.5 md:px-5" role="group" aria-label="Filter complete rounds">
            {subs.map(([id, l, n]) => (
              <button key={id} type="button" aria-pressed={sub === id} onClick={() => setSub(id)}
                className={`flex h-[34px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold ${sub === id ? "bg-ink text-night-t1" : "text-ink shadow-[inset_0_0_0_1.5px_#111]"}`}>
                {l}<span className="font-mono text-[10px] opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
        <div className={`label-mono hidden h-[34px] items-center gap-4 border-t border-line-soft px-5 text-[10px] text-ink-3 md:grid ${cols}`} aria-hidden>
          <span>SELECTION</span><span>WITH</span><span>TRACKS</span><span>STATUS</span><span />
        </div>
        {list.length === 0 ? (
          <p className="border-t border-line-soft px-5 py-5 text-[15px] text-ink-2">No rounds here.</p>
        ) : (
          <ul>
            {list.map((r) => <Row key={r.id} r={r} cols={cols} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function Row({ r, cols }: { r: Round; cols: string }) {
  const name = firstName(r.other?.name ?? "");
  const g = groupOf(r);
  const pub = g === "complete" && r.public;
  // Board M1cHomeRounds2: öffentliche Runde → „Make a story“ (öffnet die Story auf der Selection-Seite)
  const action = g !== "complete" ? "Open" : r.public ? "Make a story" : !r.my_yes ? "Say yes" : `Remind ${name}`;
  const href = pub ? `/s/${r.id}` : `/chain/${r.id}`;
  return (
    <li className="relative border-t border-line-soft">
      <div data-testid="round-row" className={`row-hover grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 md:h-16 md:gap-4 md:px-5 md:py-0 ${cols}`}>
        <span className="flex min-w-0 flex-col gap-0.5">
          {/* Die ganze Zeile ist der Link (über ::after), die Aktion rechts kann ein eigener Link sein */}
          <Link href={href} className="truncate text-[16px] font-semibold after:absolute after:inset-0 after:content-['']">{roundTitle(r)}</Link>
          <span className="text-[12px] text-ink-3">{ago(r.updated_at)}</span>
        </span>
        <span className="hidden min-w-0 items-center gap-2.5 md:flex">
          {r.other ? <><Avatar r={r} size={28} /><span className="truncate text-[14px]">{r.other.name}</span></> : <span className="text-[14px] text-ink-3">No one yet</span>}
        </span>
        <span className="hidden gap-1 md:flex" aria-label={`${r.count} of ${r.target} tracks`}>
          {Array.from({ length: r.target }, (_, i) => (
            <span key={i} className="h-[9px] w-[9px] rounded-full" style={{ background: i < r.count ? roleColor(r, i % 2 ? "B" : "A") : "#D6D6D1" }} />
          ))}
        </span>
        <span className="row-start-1 col-start-2 md:row-auto md:col-auto"><Status r={r} /></span>
        <span className="col-span-2 text-[13px] text-ink-3 md:hidden">{r.other ? `with ${r.other.name}` : statusLine(r)}</span>
        {pub ? (
          <Link href={`/s/${r.id}?story=1`} className="link-hover relative z-10 hidden justify-self-end whitespace-nowrap text-[14px] font-semibold underline underline-offset-[3px] md:block">{action}</Link>
        ) : (
          <span className="hidden justify-self-end whitespace-nowrap text-[14px] font-semibold underline underline-offset-[3px] md:block">{action}</span>
        )}
      </div>
    </li>
  );
}

// Status: fette Wörter mit kleiner Form; nur „Needs a yes“ als schwarze Pill
function Status({ r }: { r: Round }) {
  const g = groupOf(r);
  const word = (shape: React.ReactNode, l: string) => <span className="inline-flex items-center gap-2 whitespace-nowrap text-[14px] font-bold tracking-[-0.01em] text-ink">{shape}{l}</span>;
  if (g === "complete") {
    const p = pub(r);
    if (p === "yes") return <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-ink px-3 text-[13px] font-bold text-night-t1">Needs a yes</span>;
    if (p === "public") return word(<span className="h-2 w-2 bg-ink" />, "Public");
    return word(<span className="box-border h-2.5 w-2.5 rounded-full border-[1.5px] border-ink" />, "Private");
  }
  if (g === "open") return word(<span className="h-2 w-2 rounded-full border-[1.5px] border-dashed border-ink" />, "Invite open");
  if (g === "waiting") return word(<span className="ping h-2 w-2 rounded-full" style={{ background: otherColor(r) }} />, `${firstName(r.other?.name ?? "")}’s turn`);
  return word(<span className="h-0.5 w-2.5 bg-ink-3" />, "Ended");
}
