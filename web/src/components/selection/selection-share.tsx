"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/components/analytics";
import { ShareButton } from "@/components/profile/share-button";
import type { Role } from "@/lib/chains";
import { copyText } from "@/lib/copy";
import { selectionUrl, type Selection } from "@/lib/selection";
import { SelectionStoryDialog } from "./selection-story-dialog";

// Share auf der Selection-Seite (Boards DeskSelectionShare, SelectionShare, PO 27.11.2026):
// Die beiden DJs bekommen ein Menü (Desktop) bzw. Sheet (Handy) mit „Make a story“ und „Copy link“.
// Alle anderen kopieren wie bisher direkt den Link.
export function SelectionShare({ s, title, me, openStory }: { s: Selection; title: string; me: Role | null; openStory: boolean }) {
  const [open, setOpen] = useState(false);
  const [story, setStory] = useState(openStory);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      // Desktop-Menü: Klick daneben schließt; das Handy-Sheet hat einen eigenen Hintergrund
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!me) return <ShareButton name={title} color="#111111" />;

  const url = `https://${selectionUrl(s.id)}`;
  const makeStory = () => {
    setOpen(false);
    setStory(true);
  };
  const copy = async () => {
    if (!(await copyText(url))) return;
    track("selection_link_copied");
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1200);
  };

  const items = (
    <>
      <Item onClick={makeStory} title="Make a story" sub="Bands, poster or flyer for Instagram" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M9.5 7h5M9.5 10.5h5" /></svg>} />
      <Item onClick={copy} title={copied ? "Link copied" : "Copy link"} sub={selectionUrl(s.id)} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>} />
    </>
  );

  return (
    <span ref={box} className="relative flex">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="tint flex h-10 flex-none items-center gap-2 rounded-full border-[1.5px] border-ink px-4 text-[14px] font-semibold text-ink md:h-11 md:px-5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v13" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></svg>
        Share
      </button>
      {open && (
        <>
          {/* Desktop: Menü unter dem Knopf */}
          <span role="menu" aria-label="Share" className="absolute right-0 top-[54px] z-30 hidden w-[320px] flex-col rounded-[16px] bg-surface p-1.5 shadow-[0_1px_2px_rgba(17,17,17,0.08),0_20px_50px_rgba(17,17,17,0.18)] md:flex">
            {items}
          </span>
          {/* Handy: Sheet von unten */}
          <span className="fixed inset-0 z-40 md:hidden">
            <span aria-hidden className="absolute inset-0 bg-[rgba(17,17,17,0.45)]" onClick={() => setOpen(false)} />
            <span role="menu" aria-label="Share" className="sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-[20px] bg-surface px-3 pb-5 pt-2.5">
              <span aria-hidden className="h-1 w-10 self-center rounded-full bg-field-border" />
              <span className="mx-3.5 mb-1.5 mt-3.5 text-[20px] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]">Share {title}</span>
              {items}
              <button type="button" onClick={() => setOpen(false)} className="mt-6 flex h-12 items-center justify-center rounded-full border-[1.5px] border-ink text-[15px] font-semibold">Cancel</button>
            </span>
          </span>
        </>
      )}
      {story && <SelectionStoryDialog id={s.id} title={title} people={s.participants} entries={s.entries} me={me} onClose={() => setStory(false)} />}
    </span>
  );
}

function Item({ onClick, title, sub, icon }: { onClick: () => void; title: string; sub: string; icon: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="row-hover flex items-center gap-3.5 rounded-[10px] px-3.5 py-3 text-left">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-bg text-ink">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[16px] font-semibold text-ink">{title}</span>
        <span className="truncate text-[13px] text-ink-3">{sub}</span>
      </span>
    </button>
  );
}
