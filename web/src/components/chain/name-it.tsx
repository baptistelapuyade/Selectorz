"use client";

import { useState, useTransition } from "react";
import { acceptTitle, suggestTitle } from "@/app/(build)/chain/actions";
import { firstName, type Chain, type Role } from "@/lib/chains";

// Name gemeinsam (PO 27.11.2026, Boards „Abschluss · Name A–E“, Desktop und Handy):
// A die andere Person schlägt vor → zustimmen oder Gegenvorschlag
// B eigener Vorschlag wartet → ändern
// C beide einig → umbenennen heißt neu vorschlagen
// D noch kein Name → vorschlagen
// E Vorschlag schreiben
export function NameIt({ c, colors, placeholder, onChange, mobile }: {
  c: Chain; colors: Record<Role, string>; placeholder: string; onChange: (c: Chain) => void; mobile?: boolean;
}) {
  const me = c.participants.find((p) => p.me)!;
  const other = c.participants.find((p) => !p.me);
  const otherName = firstName(other?.name ?? "your partner");
  const pending = c.title_suggestion ?? null;
  const mine = !!c.title_suggested_by_me;
  const together = !!c.title_together;
  const state = pending ? (mine ? "B" : "A") : together ? "C" : "D";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const edit = () => {
    setDraft(state === "B" ? pending ?? "" : "");
    setError(null);
    setEditing(true);
  };
  const send = () =>
    start(async () => {
      const r = await suggestTitle(c.id, draft);
      if (!r.ok) return setError(r.error);
      setError(null);
      setEditing(false);
      onChange(r.chain);
    });
  const agree = () =>
    start(async () => {
      const r = await acceptTitle(c.id);
      if (!r.ok) return setError(r.error);
      setError(null);
      onChange(r.chain);
    });

  const pill = "flex h-10 items-center rounded-full bg-ink px-[18px] text-[14px] font-semibold text-night-t1 disabled:bg-field-border";
  const link = "link-hover text-[14px] font-semibold text-ink underline underline-offset-[3px]";
  const field = "box-border flex h-14 items-center rounded-s border bg-surface px-4 text-[24px] font-extrabold tracking-[-0.03em]";
  const err = error && <span role="alert" className="text-[13px] text-error-text">{error}</span>;

  // E: Vorschlag schreiben (auch D am Desktop: das Feld steht gleich offen)
  if (editing || (state === "D" && !mobile)) {
    return (
      <form data-testid="name-it" data-state="E" onSubmit={(e) => { e.preventDefault(); send(); }}
        className={`flex flex-col gap-2 text-[14px] font-semibold ${mobile ? "mx-0 mt-3" : ""}`}>
        <label htmlFor={`name-${mobile ? "m" : "d"}`} className="flex justify-between">
          Name it <span className="font-normal text-ink-3">{state === "D" && !editing ? "No name yet" : "Up to 60 characters"}</span>
        </label>
        <input id={`name-${mobile ? "m" : "d"}`} value={draft} maxLength={60} autoFocus={editing} placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          className={`${field} border-field-border outline-none placeholder:font-semibold placeholder:text-ink-4 focus:border-ink`} />
        <span className="mt-0.5 flex items-center gap-4">
          <button type="submit" disabled={busy || !draft.trim()} className={pill}>Suggest</button>
          {editing && <button type="button" onClick={() => setEditing(false)} className={link}>Cancel</button>}
        </span>
        {err}
      </form>
    );
  }

  if (mobile) {
    if (state === "A")
      return (
        <div data-testid="name-it" data-state="A" className="mt-3 flex flex-col gap-2 rounded-[12px] border-[1.5px] border-dashed px-3.5 py-3" style={{ borderColor: colors[other!.role] }}>
          <span className="text-[13px] text-ink-3">{otherName} suggests</span>
          <span className="text-[22px] font-extrabold tracking-[-0.03em] [overflow-wrap:anywhere]">{pending}</span>
          <span className="flex items-center gap-4">
            <button type="button" disabled={busy} onClick={agree} className={pill}>Sounds good</button>
            <button type="button" onClick={edit} className={link}>Suggest another</button>
          </span>
          {err}
        </div>
      );
    return (
      <span data-testid="name-it" data-state={state} className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-ink-3">
        {state === "B" ? `You suggested “${pending}”. Waiting for ${otherName}’s yes.` : state === "C" ? "Named together" : "No name yet"}
        <button type="button" onClick={edit} className="link-hover font-semibold text-ink underline underline-offset-[3px]">
          {state === "B" ? "Change" : state === "C" ? "Rename" : "Suggest a name"}
        </button>
        {err}
      </span>
    );
  }

  const dots = (
    <span className="inline-flex" aria-hidden>
      <span className="h-2 w-2 rounded-full" style={{ background: colors.A }} />
      <span className="-ml-0.5 h-2 w-2 rounded-full" style={{ background: colors.B }} />
    </span>
  );
  return (
    <div data-testid="name-it" data-state={state} className="flex flex-col gap-2 text-[14px] font-semibold">
      <span className="flex justify-between gap-3">
        Name it
        <span className="inline-flex items-center gap-1.5 text-right font-normal text-ink-3">
          {state === "A" && <><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colors[other!.role] }} />{otherName} suggests</>}
          {state === "B" && <>Waiting for {otherName}’s yes ·<button type="button" onClick={edit} className={link}>Change</button></>}
          {state === "C" && <>{dots}Named together ·<button type="button" onClick={edit} className={link}>Rename</button></>}
        </span>
      </span>
      <span className={`${field} [overflow-wrap:anywhere] ${state === "C" ? "border-field-border" : "border-[1.5px] border-dashed"}`}
        style={state === "A" ? { borderColor: colors[other!.role] } : state === "B" ? { borderColor: colors[me.role] } : undefined}>
        <span className="truncate">{state === "C" ? c.title : pending}</span>
      </span>
      {state === "A" && (
        <span className="mt-0.5 flex items-center gap-4">
          <button type="button" disabled={busy} onClick={agree} className={pill}>Sounds good</button>
          <button type="button" onClick={edit} className={link}>Suggest another</button>
        </span>
      )}
      {state === "B" && pending !== c.title && (
        <span className="text-[13px] font-normal text-ink-3">
          {c.title ? `Until ${otherName} agrees, it stays “${c.title}”.` : `Until ${otherName} agrees, it has no name yet.`}
        </span>
      )}
      {err}
    </div>
  );
}
