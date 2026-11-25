"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { renameChain, setApproval } from "@/app/(build)/chain/actions";
import { track as log } from "@/components/analytics";
import { Record } from "@/components/selection/record";
import { SelectionStoryDialog } from "@/components/selection/selection-story-dialog";
import { firstName, type Chain, type Role } from "@/lib/chains";
import { palette, selectionPath, selectionTitle, type SelPerson } from "@/lib/selection";
import { copyText } from "@/lib/copy";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

const seenKey = (id: string) => `selectorz:done:${id}`;
const noop = () => () => {};
function readSeen(id: string) {
  try {
    return localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return true;
  }
}

// Abschluss (CHAIN-09, 14.7, Boards DeskChainComplete3 und ChainComplete3) mit gemeinsamer Freigabe (PUBLISH-01..03) und Story (SHARE-07)
export function Complete({ c, onChange }: { c: Chain; onChange: (c: Chain) => void }) {
  const now = useSyncExternalStore(noop, () => readSeen(c.id), () => null);
  const [seen, setSeen] = useState<boolean | null>(null);
  if (seen === null && now !== null) setSeen(now);
  useEffect(() => {
    try {
      localStorage.setItem(seenKey(c.id), "1");
    } catch {}
  }, [c.id]);

  const [story, setStory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [kept, setKept] = useState(false);
  const [pending, start] = useTransition();

  const people = c.participants.map((p) => ({ role: p.role, name: p.name, handle: p.handle, color: p.color ?? null, instagram: p.instagram ?? null, photo: p.photo ?? null }));
  const sel: SelPerson[] = people.map((p) => ({ role: p.role, name: p.name, handle: p.handle, color: p.color, instagram: p.instagram }));
  const me = c.participants.find((p) => p.me)!;
  const other = c.participants.find((p) => !p.me);
  const otherName = firstName(other?.name ?? "your partner");
  const nameA = c.participants.find((p) => p.role === "A")?.name ?? "";
  const nameB = c.participants.find((p) => p.role === "B")?.name ?? "";
  const title = selectionTitle(c, nameA, nameB);
  const col = palette(sel);
  const yes = c.participants.filter((p) => p.approved).length;
  const [name, setName] = useState(c.title);
  const [renaming, setRenaming] = useState(false);

  const approve = (v: boolean, openStory = false) =>
    start(async () => {
      const r = await setApproval(c.id, v);
      if (!r.ok) return setError(r.error);
      setError(null);
      onChange(r.chain);
      if (v) log("chain_publication_approved", {});
      if (v && r.chain.public) log("chain_published", {});
      if (openStory && r.chain.public) setStory(true);
    });
  const keep = () => {
    setKept(true);
    if (me.approved) approve(false);
  };

  const rename = () =>
    start(async () => {
      if (name.trim() === c.title.trim()) return setRenaming(false);
      const r = await renameChain(c.id, name);
      if (!r.ok) return setError(r.error);
      setError(null);
      onChange(r.chain);
      setName(r.chain.title);
      setRenaming(false);
    });

  const ask = async () => {
    try {
      if (!(await copyText(window.location.href))) throw new Error("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const avatar = (role: Role, i: number) => {
    const p = c.participants.find((x) => x.role === role);
    const on = !!p?.approved;
    return (
      <span key={role} className={`box-border flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-[9px] font-semibold ${i ? "-ml-2" : ""}`}
        style={on ? { background: col[role], borderColor: "var(--avatar-ring)" } : { background: "var(--color-bg)", borderColor: col[role], borderStyle: "dashed" }}>
        {initials(p?.name ?? "")}
      </span>
    );
  };
  const avatars = <span className="flex flex-none" aria-hidden>{(["A", "B"] as Role[]).map(avatar)}</span>;

  const headline = c.public ? "It’s public." : me.approved ? `Waiting for ${otherName}’s yes.` : other?.approved ? `Show it publicly? ${otherName} said yes.` : "Show it publicly?";
  const sub = c.public
    ? "On both profiles, with its own page and a story. You can take it back anytime."
    : me.approved
      ? `It goes public when ${otherName} says yes too. Until then it stays between you two.`
      : kept
        ? "It stays between you two. You can still say yes later."
        : "On both profiles, with its own page and a story. You can take it back anytime.";
  const subMobile = !c.public && !me.approved && !kept && other?.approved ? `${otherName} said yes. It goes on both pages with a story. Take it back anytime.` : sub;

  const actions = c.public ? (
    <span className="grid gap-2.5 md:grid-cols-[1fr_auto]">
      <button type="button" onClick={() => setStory(true)} className="cta flex h-[54px] items-center justify-between rounded-full bg-ink px-[22px] text-[16px] font-semibold text-night-t1 md:h-[46px] md:px-5 md:text-[14px]">
        Make a story <span aria-hidden className="cta-arrow">→</span>
      </button>
      <Link href={selectionPath(c.id)} className="flex h-[46px] items-center justify-center rounded-full border-[1.5px] border-field-border px-5 text-[14px] font-semibold hover:border-ink">Open the page</Link>
    </span>
  ) : me.approved ? (
    <button type="button" onClick={ask} className="h-[46px] self-start rounded-full border-[1.5px] border-field-border px-5 text-[14px] font-semibold hover:border-ink">
      {copied ? "Link copied" : `Ask ${otherName}: copy link to this round`}
    </button>
  ) : (
    <span className="grid gap-2.5 md:grid-cols-[1fr_auto]">
      <button type="button" disabled={pending} onClick={() => approve(true, true)} className="cta flex h-[54px] items-center justify-between rounded-full bg-ink px-[22px] text-[16px] font-semibold text-night-t1 disabled:bg-field-border md:h-[46px] md:px-5 md:text-[14px]">
        {kept ? "Say yes after all" : "Approve and make a story"} <span aria-hidden className="cta-arrow">→</span>
      </button>
      {!kept && (
        <button type="button" onClick={keep} className="link-hover justify-self-center text-[14px] font-semibold underline underline-offset-[3px] md:flex md:h-[46px] md:items-center md:justify-center md:rounded-full md:border-[1.5px] md:border-field-border md:px-5 md:no-underline md:hover:border-ink">
          Keep it between us
        </button>
      )}
    </span>
  );

  // Wellenform der Automix-Karte: je Track ein Abschnitt in der Farbe der Person
  const bars = Array.from({ length: 46 }, (_, i) => {
    const e = c.entries[Math.min(c.entries.length - 1, Math.floor((i * c.entries.length) / 46))];
    return { h: 8 + Math.round(25 * Math.abs(Math.cos(i * 0.2 + 0.5))), color: e?.role === "B" ? col.B : col.A, o: 0.55 + 0.45 * Math.abs(Math.cos(i * 0.2 + 0.5)) };
  });

  return (
    <div className={`done ${seen ? "done-seen" : ""} mx-auto grid w-full max-w-[1440px] flex-1 overflow-x-clip gap-0 px-4 pb-6 pt-3.5 md:grid-cols-[minmax(0,680px)_minmax(0,1fr)] md:gap-14 md:px-20 md:pb-12 md:pt-11`}>
      <h1 className="done-text text-[42px] font-extrabold leading-[0.9] tracking-[-0.05em] md:hidden">Your selection is complete.</h1>
      <div className="mt-[26px] flex min-w-0 flex-col gap-4 md:mt-0">
        <div className="relative pb-[4%] [--disc-out:28%] md:[--disc-out:39%]">
          <Record id={c.id} title={title} people={people} tracks={c.entries.length} className="w-[84%] md:w-[73.5%]" />
        </div>
        <span className="hidden max-w-[500px] text-[13px] leading-[1.45] text-ink-3 md:block">
          A split, like a split EP: your profile photos side by side, made automatically. {c.target === 6 ? "Six tracks, three each." : `${c.entries.length} tracks.`}
        </span>
        <span className="flex items-center gap-2.5 text-[13px] text-ink-3 md:hidden">
          {c.title ? `Named by ${firstName(nameA)}` : "No name yet"}
          <button type="button" onClick={() => setRenaming(true)} className="link-hover font-semibold text-ink underline underline-offset-[3px]">Rename</button>
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-[18px]">
        <div className="done-text hidden flex-col gap-[18px] md:flex">
          <span className="label-mono text-ink-3">{c.entries.length} OF {c.target} · {firstName(nameA).toUpperCase()} × {firstName(nameB).toUpperCase()}</span>
          <h1 className="text-[60px] font-extrabold leading-[0.88] tracking-[-0.055em]">Your selection is complete.</h1>
        </div>
        <label className={`${renaming ? "flex" : "hidden"} mt-4 flex-col gap-2 text-[14px] font-semibold md:mt-0 md:flex`}>
          <span className="flex justify-between">Name it <span className="font-normal text-ink-3">{c.title ? `Suggested by ${firstName(nameA)}` : "Up to 60 characters"}</span></span>
          <input value={name} maxLength={60} placeholder={selectionTitle({ title: "" }, nameA, nameB)} onChange={(e) => setName(e.target.value)} onBlur={rename}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="h-14 rounded-s border border-field-border bg-surface px-4 text-[24px] font-extrabold tracking-[-0.03em] outline-none placeholder:font-semibold placeholder:text-ink-4 focus:border-ink" />
        </label>

        <div className="done-steps flex flex-col gap-[18px]">
          <section className="mt-10 flex flex-col gap-4 rounded-[18px] bg-night-bg px-5 py-[22px] text-night-t1 shadow-[-8px_0_26px_rgba(140,147,255,0.4),8px_0_26px_rgba(240,83,42,0.35)] md:mt-1.5 md:rounded-[20px] md:p-[26px] md:shadow-[-10px_0_34px_rgba(140,147,255,0.45),10px_0_34px_rgba(240,83,42,0.4)]" aria-label="Automix">
            <span className="flex justify-between">
              <span className="label-mono text-night-t2">AUTOMIX</span>
              <span className="label-mono text-night-t2">{c.entries.length} TRACKS · COMING SOON</span>
            </span>
            <span className="text-[34px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[44px]">Press it into a mix.</span>
            <span className="hidden text-[15px] leading-[1.45] text-night-t2 md:block">Automix blends your {c.entries.length === 6 ? "six" : c.entries.length} tracks into one continuous mix, with real transitions. You can fine-tune every blend afterwards.</span>
            <span aria-hidden className="flex h-8 items-center gap-[3px] overflow-hidden md:h-10">
              {bars.map((b, i) => <span key={i} className="w-1.5 flex-none rounded-[3px] md:w-[7px] md:rounded-[4px]" style={{ height: b.h, background: b.color, opacity: b.o }} />)}
            </span>
            <button type="button" disabled className="flex h-14 items-center justify-between rounded-full px-[22px] text-[16px] font-extrabold text-night-bg opacity-60 md:h-[60px] md:px-[26px] md:text-[17px]"
              style={{ background: `linear-gradient(90deg, ${col.A}, ${col.B})` }}>
              Press it into a mix <span aria-hidden>→</span>
            </button>
            <span className="text-[13px] leading-[1.4] text-night-t2">Coming soon. Automix arrives in a later update.</span>
          </section>

          <section className="mt-6 flex flex-col gap-4 [--avatar-ring:var(--color-bg)] md:mt-0 md:gap-3.5 md:rounded-[14px] md:border md:border-line md:bg-surface md:p-[18px] md:[--avatar-ring:#fff]" aria-labelledby="pub-title">
            <span className="flex items-baseline justify-between border-t-2 border-ink pt-3 md:hidden">
              <span className="text-[22px] font-semibold tracking-[-0.02em]">{c.public ? "It’s public." : "Show it publicly?"}</span>
              <span className="label-mono text-ink-3">{yes} OF 2 SAID YES</span>
            </span>
            <span className="flex items-center gap-3 md:gap-3.5">
              {avatars}
              <span className="hidden flex-1 flex-col gap-0.5 md:flex">
                <span id="pub-title" className="text-[16px] font-semibold">{headline}</span>
                <span className="text-[13px] text-ink-3">{sub}</span>
              </span>
              <span className="text-[14px] leading-[1.4] text-ink-2 md:hidden">{subMobile}</span>
              <span className="label-mono hidden text-ink-3 md:block" aria-label={`${yes} of 2 said yes`}>{yes} OF 2</span>
            </span>
            {actions}
            {(me.approved || c.public) && (
              <button type="button" disabled={pending} onClick={() => approve(false)} className="link-hover self-start text-[13px] font-semibold text-ink-2 underline underline-offset-4">
                Take back my yes
              </button>
            )}
            {error && <p role="alert" className="text-[13px] text-error-text">{error}</p>}
          </section>

          <span className="mt-8 flex justify-center border-t border-line pt-5 md:mt-0 md:border-0 md:pt-0">
            <Link href="/chain/new" className="link-hover text-[14px] font-semibold underline underline-offset-[3px]">Start another chain with {otherName}</Link>
          </span>
        </div>
      </div>

      {story && <SelectionStoryDialog id={c.id} title={title} people={sel} entries={c.entries} me={me.role} onClose={() => setStory(false)} />}
    </div>
  );
}
