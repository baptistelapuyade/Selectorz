"use client";

import { useEffect } from "react";
import { useClosable } from "@/components/use-closable";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;     // links im Fuß (z. B. „Remove section“)
  note?: string;                // Hinweis im Fuß
};

// Panel rechts (Desktop) bzw. Sheet von unten (mobil), wie M1cBasics/M1cSection.
export function Panel({ title, onClose, children, footer, note = "Saved to your draft. Publish when you're ready." }: Props) {
  const { closing, close } = useClosable(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  const id = `panel-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={`fixed inset-0 z-50 text-ink ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={close} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.55)] active:scale-100" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="sheet absolute inset-x-0 bottom-0 top-[56px] flex flex-col rounded-t-[22px] bg-bg md:inset-y-0 md:left-auto md:top-0 md:right-0 md:w-[540px] md:rounded-none md:shadow-modal"
      >
        <header className="flex h-[72px] flex-none items-center justify-between gap-4 border-b border-line px-5 md:px-7">
          <h2 id={id} className="truncate text-[26px] font-extrabold tracking-[-0.035em]">{title}</h2>
          <button type="button" onClick={close} className="h-9 flex-none rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-semibold hover:bg-ink hover:text-night-t1">
            Close ✕
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 md:px-7">{children}</div>
        <footer className="flex flex-none items-center justify-between gap-4 border-t border-line px-5 py-4 md:px-7">
          {footer ?? <span className="text-[13px] text-ink-3">{note}</span>}
          <button type="button" onClick={close} className="cta flex h-[52px] flex-none items-center gap-5 rounded-full bg-ink px-6 text-[15px] font-semibold text-night-t1">
            Done <span aria-hidden className="cta-arrow">→</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

// Griff + Pfeile + Entfernen für Listen (Sections, Tracks): gleich überall (PO-Feedback 23.11.)
export function Grip() {
  return (
    <span aria-hidden="true" className="flex h-10 w-5 flex-none cursor-grab items-center justify-center text-ink-4">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
    </span>
  );
}

export function Arrow({ dir, label, disabled, onClick }: { dir: "up" | "down"; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-line-soft disabled:opacity-25 disabled:hover:bg-transparent">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        {dir === "up" ? <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></> : <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>}
      </svg>
    </button>
  );
}

// Ziehen und Ablegen mit der Maus (Desktop). Tastatur und Touch nutzen die Pfeile.
export function useDragList(onMove: (from: number, to: number) => void) {
  return (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isInteger(from)) onMove(from, i);
    },
  });
}
