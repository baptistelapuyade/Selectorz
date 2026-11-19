"use client";

import { useActionState, useState } from "react";
import { sendCode, verifyCode, resendCode, type LoginState } from "./actions";

const initial: LoginState = { step: "email", email: "" };

export function LoginForm() {
  const [sent, sendAction, sending] = useActionState(sendCode, initial);
  const [verified, verifyAction, verifying] = useActionState(verifyCode, initial);
  const [resent, resendAction, resending] = useActionState(resendCode, initial);
  const [editing, setEditing] = useState(false);
  // Welche Aktion zuletzt lief, damit Fehler und Hinweise nicht veralten.
  const [last, setLast] = useState<"verify" | "resend">("verify");

  const onCodeStep = sent.step === "code" && !editing;
  const email = sent.email;
  const codeError = last === "verify" ? verified.error : resent.error;

  if (!onCodeStep) {
    return (
      <form action={(fd) => { setEditing(false); sendAction(fd); }} className="flex flex-col gap-6">
        <Heading title="Welcome back." sub="No password. Enter your email and we send you a code." />
        <label className="flex flex-col gap-2">
          <span className="label-mono text-ink-3">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={email}
            placeholder="you@example.com"
            className={`h-14 rounded-s border bg-surface px-4 text-[16px] outline-none focus:border-2 focus:border-ink ${sent.error ? "border-2 border-error-border" : "border-field-border"}`}
          />
          {sent.error && <span className="text-[13px] text-error-text">{sent.error}</span>}
        </label>
        <Primary busy={sending}>Send me a code</Primary>
      </form>
    );
  }

  return (
    <form
      action={(fd) => {
        // Ziel nach dem Login aus der Adresse lesen (der Server prüft es noch einmal)
        fd.set("next", new URLSearchParams(window.location.search).get("next") ?? "/home");
        verifyAction(fd);
      }}
      className="flex flex-col gap-6"
    >
      <Heading
        title="Check your inbox."
        sub={
          <>
            We sent a code to <strong className="font-semibold text-ink">{email}</strong>. It works for 10 minutes.
          </>
        }
      />
      <input type="hidden" name="email" value={email} />
      <label className="flex flex-col gap-2">
        <span className="label-mono text-ink-3">6-digit code</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={8}
          required
          autoFocus
          placeholder="000000"
          className={`h-16 rounded-s border bg-surface px-4 font-mono text-[28px] tracking-[0.4em] outline-none focus:border-2 focus:border-ink ${codeError ? "border-2 border-error-border" : "border-field-border"}`}
        />
        {codeError && <span className="text-[13px] text-error-text">{codeError}</span>}
        {!codeError && resent.notice && <span className="text-[13px] text-ok">{resent.notice}</span>}
      </label>
      <Primary busy={verifying} onClick={() => setLast("verify")}>Log in</Primary>
      <div className="flex gap-5 text-[14px]">
        <button formAction={resendAction} formNoValidate onClick={() => setLast("resend")} disabled={resending} className="font-semibold underline underline-offset-4 disabled:opacity-50">
          Send a new code
        </button>
        <button type="button" onClick={() => setEditing(true)} className="font-semibold underline underline-offset-4">
          Change email
        </button>
      </div>
    </form>
  );
}

function Heading({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[64px]">{title}</h1>
      <p className="text-[15px] leading-[1.45] text-ink-2 md:text-[17px]">{sub}</p>
    </div>
  );
}

function Primary({ busy, children, onClick }: { busy: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={busy}
      className="flex h-[58px] items-center justify-between rounded-full bg-ink px-7 text-[16px] font-semibold text-night-t1 shadow-cta transition-transform hover:-translate-y-0.5 active:scale-[0.96] disabled:bg-field-border disabled:shadow-none"
    >
      <span>{busy ? "One moment…" : children}</span>
      <span aria-hidden>→</span>
    </button>
  );
}
