"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { submitReport, type ReportState } from "@/app/report/actions";
import { useClosable } from "@/components/use-closable";

const REASONS = [
  { id: "spam", label: "Spam or ads" },
  { id: "impersonation", label: "Pretends to be someone else" },
  { id: "offensive", label: "Hateful or harmful" },
  { id: "other", label: "Something else" },
];

// Board „Seite melden“: Sheet mobil, Panel von rechts am Desktop
export function ReportLink({ targetType, targetId, accountId, name, color }: { targetType: string; targetId: string; accountId: string; name: string; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-hover font-mono text-[10px] tracking-[0.08em] underline underline-offset-4" style={{ color }}>
        REPORT
      </button>
      {open && <ReportDialog onClose={() => setOpen(false)} targetType={targetType} targetId={targetId} accountId={accountId} name={name} />}
    </>
  );
}

function ReportDialog({ onClose: done, targetType, targetId, accountId, name }: { onClose: () => void; targetType: string; targetId: string; accountId: string; name: string }) {
  const { closing, close: onClose } = useClosable(done);
  const [state, action, pending] = useActionState(submitReport, { status: "idle" } as ReportState);
  // Felder selbst halten, damit nach einer Fehlermeldung nichts verloren geht
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [reason, setReason] = useState("");
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-50 font-sans text-[16px] font-normal normal-case tracking-normal text-ink ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={onClose} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.55)] active:scale-100" />
      <div role="dialog" aria-modal="true" aria-labelledby="rp-title" className="sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-[22px] bg-bg px-4 pb-6 pt-3 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:px-8 md:py-7 md:shadow-modal">
        <span className="mx-auto h-1 w-10 rounded-full bg-field-border md:hidden" />
        {state.status === "sent" ? (
          <div className="flex flex-col gap-4">
            <h2 id="rp-title" className="text-[30px] font-extrabold leading-[0.95] tracking-[-0.045em]">Thanks. We&apos;ll take a look.</h2>
            <p className="text-[15px] text-ink-2">Only we see your report. If it breaks the rules, the page goes offline.</p>
            <button onClick={onClose} className="h-[50px] rounded-full border-[1.5px] border-ink text-[15px] font-semibold hover:bg-ink hover:text-night-t1">Close</button>
          </div>
        ) : state.status === "login" ? (
          <div className="flex flex-col gap-4">
            <h2 id="rp-title" className="text-[30px] font-extrabold leading-[0.95] tracking-[-0.045em]">Log in to report</h2>
            <p className="text-[15px] text-ink-2">So we can stop fake reports. It takes one code.</p>
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="cta flex h-[54px] items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-night-t1">Log in</Link>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="rp-title" className="text-[30px] font-extrabold leading-[0.95] tracking-[-0.045em]">Report this page</h2>
              <p className="text-[13px] text-ink-3">selectorz.art{pathname} · Only we see your report.</p>
            </div>
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <input type="hidden" name="block_account" value={accountId} />
            <input type="hidden" name="page" value={pathname} />
            <fieldset className="flex flex-col">
              <legend className="sr-only">What&apos;s wrong?</legend>
              {REASONS.map((r) => (
                <label key={r.id} className="row-hover flex h-[52px] cursor-pointer items-center gap-3 border-t border-line text-[15px]">
                  <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-5 w-5 accent-ink" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              <span>What happened? <span className="font-normal text-ink-3">Optional</span></span>
              <textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="field rounded-s border border-field-border bg-surface px-3.5 py-3 text-[16px] font-normal outline-none focus:border-2 focus:border-ink" />
            </label>
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" name="also_block" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="h-5 w-5 accent-ink" />
              Also block {name}
            </label>
            {state.error && <p key={state.error} className="shake text-[13px] text-error-text">{state.error}</p>}
            <button disabled={pending || !reason} className="cta flex h-[58px] items-center justify-between rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none">
              <span>{pending ? "Sending…" : "Send report"}</span><span aria-hidden className="cta-arrow">→</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
