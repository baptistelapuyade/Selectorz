"use client";

import { useEffect, useRef } from "react";
import { useClosable } from "@/components/use-closable";

type Props = { handle: string; pending: boolean; onConfirm: () => void; onClose: () => void };

// Seite offline nehmen (M1cOffline): Rückfrage, sicherer Knopf hat den Fokus, der zerstörerische ist rot.
export function OfflineDialog({ handle, pending, onConfirm, onClose }: Props) {
  const { closing, close } = useClosable(onClose);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center text-ink md:items-center ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={close} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.55)] active:scale-100" />
      <section role="alertdialog" aria-modal="true" aria-labelledby="off-title" aria-describedby="off-text" className="sheet relative flex w-full max-w-[560px] flex-col gap-4 rounded-t-[22px] bg-bg p-6 md:rounded-[22px] md:p-9 md:shadow-modal">
        <span className="label-mono text-ink-3">selectorz.art/{handle}</span>
        <h2 id="off-title" className="text-[34px] font-extrabold leading-[0.95] tracking-[-0.045em] md:text-[40px]">Take your page offline?</h2>
        <p id="off-text" className="text-[16px] leading-[1.5] text-ink-2">
          People who open your link will see “No page here.” until you publish again. Your draft, photo and sections stay saved, and your address stays yours.
        </p>
        <p className="text-[13px] leading-[1.45] text-ink-3">
          <b className="text-ink">Nothing gets deleted.</b> You can publish again any time. Previews already shared in chats or stories can still show the old picture for a while.
        </p>
        <span className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button ref={keep} type="button" onClick={close} className="h-[54px] rounded-full border-[1.5px] border-ink text-[15px] font-semibold outline-offset-2 hover:bg-ink hover:text-night-t1">
            Keep it live
          </button>
          <button type="button" disabled={pending} onClick={onConfirm} className="flex h-[54px] items-center justify-center gap-2 rounded-full bg-error-border text-[15px] font-semibold text-white disabled:opacity-60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
            {pending ? "Taking it offline…" : "Take it offline"}
          </button>
        </span>
      </section>
    </div>
  );
}
