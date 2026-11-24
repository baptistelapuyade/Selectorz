"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { sendBuildCode, verifyBuildCode } from "@/app/(build)/start/actions";
import { track } from "@/components/analytics";
import { useClosable } from "@/components/use-closable";

type Text = { eyebrow: string; title: string; intro: string; action: string; acting: string; from: string; legal: string };
const LIVE: Text = {
  eyebrow: "Almost live",
  title: "One last step.",
  intro: "Your page is ready. Confirm your email to save it and go live. No password, just a code.",
  action: "Go live",
  acting: "Going live…",
  from: "build",
  legal: "By going live you agree that your page is public. Your email is never shown on it.",
};
type Props = { onVerified: () => Promise<void>; onClose: () => void; error: string | null; text?: Partial<Text> };

// Login im selben Fenster, erst beim Live-Gehen (Plan M1b): Mail → 6-stelliger Code → „Go live“.
export function LiveSheet({ onVerified, onClose: done, error: outer, text }: Props) {
  const tx = { ...LIVE, ...text };
  const { closing, close } = useClosable(done);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, pending]);

  const send = (again = false) =>
    start(async () => {
      const r = await sendBuildCode(email);
      if (!r.ok) return setError(r.error);
      setError(null);
      setNotice(again ? "New code sent. Only the newest one works." : null);
      setStep("code");
      track("login_code_requested", { from: tx.from });
    });

  const verify = () =>
    start(async () => {
      const r = await verifyBuildCode(email, code);
      if (!r.ok) return setError(r.error);
      setError(null);
      await onVerified();
    });

  const shown = error ?? outer;
  const field = "field h-14 rounded-s border border-field-border bg-surface px-4 text-[17px] font-normal outline-none focus:border-2 focus:border-ink";

  return (
    <div className={`fixed inset-0 z-50 text-ink ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={() => !pending && close()} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.55)] active:scale-100" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-title"
        className="sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col gap-5 overflow-y-auto rounded-t-[22px] bg-bg px-4 pb-6 pt-3 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[460px] md:rounded-none md:px-9 md:py-9 md:shadow-modal"
      >
        <span className="mx-auto h-1 w-10 rounded-full bg-field-border md:hidden" />
        <div className="flex flex-col gap-2">
          <span className="label-mono text-ink-3">{tx.eyebrow}</span>
          <h2 id="live-title" className="text-[34px] font-extrabold leading-[0.95] tracking-[-0.045em]">{tx.title}</h2>
          <p className="text-[15px] leading-[1.45] text-ink-2">
            {step === "email"
              ? tx.intro
              : `We sent a 6-digit code to ${email}. It works for 10 minutes.`}
          </p>
          {step !== "email" && (
            <p className="text-[13px] leading-[1.4] text-ink-3">Nothing after a minute? Check your spam folder, some providers like GMX or Web.de put it there.</p>
          )}
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "email") send();
            else verify();
          }}
        >
          {step === "email" ? (
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              Email
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              6-digit code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${field} h-16 font-mono text-[26px] tracking-[0.4em]`}
              />
            </label>
          )}
          {shown && <p key={shown} role="alert" className="shake text-[13px] text-error-text">{shown}</p>}
          {notice && <p className="text-[13px] text-ink-3">{notice}</p>}
          <button
            type="submit"
            disabled={pending}
            className="cta flex h-[58px] items-center justify-between rounded-full bg-ink px-7 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none"
          >
            <span>{pending ? (step === "email" ? "Sending…" : tx.acting) : step === "email" ? "Send me a code" : tx.action}</span>
            <span aria-hidden className="cta-arrow">→</span>
          </button>
          {step === "code" && (
            <span className="flex justify-between text-[14px]">
              <button type="button" disabled={pending} onClick={() => send(true)} className="link-hover font-semibold underline underline-offset-4 disabled:opacity-50">
                Send a new code
              </button>
              <button type="button" disabled={pending} onClick={() => { setStep("email"); setCode(""); setError(null); }} className="link-hover font-semibold underline underline-offset-4">
                Change email
              </button>
            </span>
          )}
        </form>
        <p className="mt-auto text-[12px] leading-[1.45] text-ink-3">
          {tx.legal} <Link href="/privacy" className="link-hover underline underline-offset-2">Privacy</Link>
        </p>
      </section>
    </div>
  );
}
