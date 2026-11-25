"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { setApproval } from "@/app/(build)/chain/actions";
import { track as log } from "@/components/analytics";
import { Record } from "@/components/selection/record";
import { SelectionStoryDialog } from "@/components/selection/selection-story-dialog";
import { firstName, type Chain } from "@/lib/chains";
import { palette, selectionPath, selectionTitle, type SelPerson } from "@/lib/selection";
import { copyText } from "@/lib/copy";

const seenKey = (id: string) => `selectorz:done:${id}`;
const noop = () => () => {};
function readSeen(id: string) {
  try {
    return localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return true;
  }
}

// Abschluss (CHAIN-09, 14.7, Board DeskChainComplete3) mit gemeinsamer Freigabe (PUBLISH-01..03) und Story (SHARE-07)
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
  const [pending, start] = useTransition();

  const people: SelPerson[] = c.participants.map((p) => ({ role: p.role, name: p.name, handle: p.handle, color: p.color ?? null, instagram: p.instagram ?? null }));
  const me = c.participants.find((p) => p.me)!;
  const other = c.participants.find((p) => !p.me);
  const otherName = firstName(other?.name ?? "your partner");
  const title = selectionTitle(c, c.participants.find((p) => p.role === "A")?.name ?? "", c.participants.find((p) => p.role === "B")?.name ?? "");
  const col = palette(people);
  const yes = c.participants.filter((p) => p.approved).length;

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

  const ask = async () => {
    try {
      if (!(await copyText(window.location.href))) throw new Error("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={`done ${seen ? "done-seen" : ""} grid flex-1 gap-10 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,544px)] md:gap-16 md:px-20 md:py-12`}>
      <div className="flex min-w-0 flex-col gap-6">
        <span className="grid grid-cols-6 gap-1.5" aria-hidden>
          {c.entries.map((e, i) => (
            <span key={e.position} className="done-band h-2 rounded-full" style={{ background: e.role === "A" ? col.A : col.B, animationDelay: `${i * 0.35}s`, outline: col.white ? "1px solid #111" : undefined }} />
          ))}
        </span>
        <div className="flex justify-start [--disc-out:42%] md:[--disc-out:52%]">
          <Record id={c.id} title={title} people={people} tracks={c.entries.length} />
        </div>
        <p className="text-[13px] text-ink-3">The label is made from your selection: its title, both names, six tracks.</p>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="done-text flex flex-col gap-3">
          <span className="label-mono text-ink-3">{c.entries.length} OF {c.target} · {firstName(c.participants[0]?.name ?? "").toUpperCase()} × {firstName(c.participants[1]?.name ?? "").toUpperCase()}</span>
          <h1 className="text-[52px] font-extrabold leading-[0.9] tracking-[-0.06em] md:text-[68px]">Your selection is complete.</h1>
        </div>

        <div className="done-steps flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface p-5" aria-labelledby="pub-title">
            <span className="flex items-start gap-3">
              <span className="flex flex-col">
                <span id="pub-title" className="text-[18px] font-semibold">
                  {c.public ? "It’s public." : me.approved ? `Waiting for ${otherName}’s yes.` : other?.approved ? `Show it publicly? ${otherName} said yes.` : "Show it publicly?"}
                </span>
                <span className="text-[14px] leading-[1.45] text-ink-2">
                  {c.public
                    ? "On both profiles, with its own page and a story. You can take it back anytime."
                    : me.approved
                      ? `It goes public when ${otherName} says yes too. Until then it stays between you two.`
                      : "On both profiles, with its own page and a story. You can take it back anytime."}
                </span>
              </span>
              <span className="label-mono ml-auto flex-none text-ink-3" aria-label={`${yes} of 2 said yes`}>{yes} OF 2</span>
            </span>
            {c.public ? (
              <span className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setStory(true)} className="cta flex h-[52px] flex-none items-center sm:flex-1 justify-between rounded-full bg-ink px-5 text-[15px] font-semibold text-night-t1 shadow-cta">
                  Make a story <span aria-hidden className="cta-arrow">→</span>
                </button>
                <Link href={selectionPath(c.id)} className="flex h-[52px] items-center justify-center rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold">Open the page</Link>
              </span>
            ) : me.approved ? (
              <button type="button" onClick={ask} className="h-[52px] self-start rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold">
                {copied ? "Link copied" : `Ask ${otherName}: copy link to this round`}
              </button>
            ) : (
              <span className="flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={pending} onClick={() => approve(true, true)} className="cta flex h-[52px] flex-none items-center sm:flex-1 justify-between rounded-full bg-ink px-5 text-[15px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border">
                  Approve and make a story <span aria-hidden className="cta-arrow">→</span>
                </button>
                <span className="flex h-[52px] items-center justify-center px-2 text-[14px] text-ink-3">Or keep it between you two.</span>
              </span>
            )}
            {(me.approved || c.public) && (
              <button type="button" disabled={pending} onClick={() => approve(false)} className="link-hover self-start text-[13px] font-semibold text-ink-2 underline underline-offset-4">
                Take back my yes
              </button>
            )}
            {error && <p role="alert" className="text-[13px] text-error-text">{error}</p>}
          </section>

          <section className="flex flex-col gap-3 rounded-[18px] bg-night-bg p-5 text-night-t1" aria-label="Automix">
            <span className="flex justify-between"><span className="label-mono text-night-t3">AUTOMIX</span><span className="label-mono text-night-t3">COMING SOON</span></span>
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.05em]">Press it into a mix.</span>
            <span className="text-[14px] leading-[1.45] text-night-t2">Automix blends your six tracks into one continuous mix. It arrives in a later update.</span>
            <button type="button" disabled className="h-[52px] rounded-full bg-night-line text-[15px] font-semibold text-night-t3">Press it into a mix</button>
          </section>

          <Link href="/chain/new" className="link-hover self-center text-[14px] font-semibold underline underline-offset-4">Start another chain</Link>
        </div>
      </div>

      {story && <SelectionStoryDialog id={c.id} title={title} people={people} entries={c.entries} me={me.role} onClose={() => setStory(false)} />}
    </div>
  );
}
