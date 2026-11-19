"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback, type FeedbackState } from "@/app/feedback/actions";
import { track } from "@/components/analytics";

const KINDS = [
  { id: "bug", label: "Bug" },
  { id: "confusing", label: "Confusing" },
  { id: "idea", label: "Idea" },
  { id: "love", label: "Love it" },
];

// Alpha-Streifen auf jeder Seite (Board „Alpha · Feedback“). Ein schwarzer Balken,
// Feedback als Sheet (mobil) bzw. Panel von rechts (Desktop).
export function AlphaBar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex h-8 items-center gap-3 bg-ink pl-4 pr-2 font-mono text-[10px] tracking-[0.08em] text-night-t1 md:pl-10">
        <span className="text-lime">ALPHA</span>
        <span className="truncate text-night-t2">
          <span className="hidden md:inline">YOU&apos;RE TESTING AN EARLY VERSION. </span>SOMETHING OFF? TELL US.
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`ml-auto h-6 shrink-0 rounded-full px-3 font-sans text-[12px] font-semibold tracking-normal text-ink ${open ? "bg-lime" : "bg-night-t1"}`}
        >
          Feedback
        </button>
      </div>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

const initial: FeedbackState = { status: "idle" };

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(submitFeedback, initial);
  const [kind, setKind] = useState("bug");
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (state.status === "sent") track("feedback_sent", { kind });
  }, [state.status, kind]);

  const sent = state.status === "sent";
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[rgba(17,17,17,0.55)]" />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title"
        className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] md:max-h-none flex-col gap-4 overflow-y-auto rounded-t-[22px] px-4 pb-6 pt-3 md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:rounded-none md:px-8 md:py-7 md:shadow-modal ${sent ? "bg-night-bg text-night-t1" : "bg-bg text-ink"}`}
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-field-border md:hidden" />
        <button onClick={onClose} aria-label="Close feedback" className="hidden h-10 w-10 items-center justify-center self-end rounded-full border-[1.5px] border-ink md:flex">
          ✕
        </button>
        {sent ? (
          <div className="flex flex-col gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-ink">✓</span>
            <h2 id="fb-title" className="text-[34px] font-extrabold leading-[0.92] tracking-[-0.045em]">Got it.<br />Thank you.</h2>
            <p className="text-[15px] leading-[1.45] text-night-t2">Baptiste reads every note. If you said yes to email, you might hear back.</p>
            <button onClick={onClose} className="h-[50px] rounded-full bg-night-t1 text-[15px] font-semibold text-ink">Back to the page</button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 id="fb-title" className="text-[30px] font-extrabold leading-[0.95] tracking-[-0.045em]">What&apos;s on your mind?</h2>
              <p className="text-[13px] leading-[1.4] text-ink-3">You&apos;re testing an early version. Every note goes straight to Baptiste.</p>
            </div>
            <div role="radiogroup" aria-label="Kind of feedback" className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`h-9 rounded-full px-4 text-[14px] font-semibold ${kind === k.id ? "bg-ink text-night-t1" : "border-[1.5px] border-chip-border"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="page" value={pathname} />
            <label className="absolute -left-[9999px]" aria-hidden="true">
              Website <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              Tell us more
              <textarea
                name="message"
                required
                maxLength={3000}
                rows={4}
                className="rounded-s border border-field-border bg-surface px-3.5 py-3 text-[16px] font-normal leading-[1.4] outline-none focus:border-2 focus:border-ink"
              />
            </label>
            <span className="flex items-center gap-2 text-[12px] text-ink-3">
              <span className="label-mono text-ink-4">Page</span>selectorz.art{pathname} · added for you
            </span>
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" name="contact_ok" defaultChecked className="h-5 w-5 accent-ink" />
              You can email me about this
            </label>
            {state.error && <p className="text-[13px] text-error-text">{state.error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="flex h-[58px] items-center justify-between rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none"
            >
              <span>{pending ? "Sending…" : "Send feedback"}</span>
              <span aria-hidden>→</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
