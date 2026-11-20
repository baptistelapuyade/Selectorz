"use client";

import { useActionState } from "react";
import { deleteAccount, type DeleteState } from "../actions";

export function DeleteForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccount, {} as DeleteState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-[14px] font-semibold">
        Type your email to confirm: <span className="font-mono text-[13px] font-normal">{email}</span>
        <input
          name="confirm"
          autoComplete="off"
          className={`field h-14 rounded-s border bg-surface px-4 text-[16px] font-normal outline-none focus:border-2 focus:border-ink ${state.error ? "border-2 border-error-border" : "border-field-border"}`}
        />
      </label>
      {state.error && <p key={state.error} className="shake text-[13px] text-error-text">{state.error}</p>}
      <button disabled={pending} className="h-[54px] rounded-full bg-error-border text-[16px] font-semibold text-white hover:bg-error-text disabled:opacity-60">
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
