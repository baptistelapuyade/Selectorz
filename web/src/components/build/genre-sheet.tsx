"use client";

import { useEffect, useMemo, useState } from "react";
import { useClosable } from "@/components/use-closable";
import { GENRE_GROUPS, GENRES, MAIN_GENRES } from "@/lib/build/genres";

type Props = { value: string[]; onDone: (genres: string[]) => void; onClose: () => void };

// „Your sound“: Hauptstile als Chips, Subgenres per Suche und gruppierter Liste; höchstens drei (PRD 14.13).
export function GenreSheet({ value, onDone, onClose: done }: Props) {
  const { closing, close } = useClosable(done);
  const [picked, setPicked] = useState<string[]>(value);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const toggle = (g: string) =>
    setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : p.length >= 3 ? p : [...p, g]));

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GENRE_GROUPS.map((group) => ({
      group,
      items: GENRES.filter((g) => g.group === group && (!needle || g.name.toLowerCase().includes(needle))),
    })).filter((g) => g.items.length);
  }, [q]);

  const full = picked.length >= 3;

  return (
    <div className={`fixed inset-0 z-50 text-ink ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={close} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.5)] active:scale-100" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="genre-title"
        className="sheet absolute inset-x-0 bottom-0 top-[70px] flex flex-col rounded-t-[22px] bg-bg md:inset-y-0 md:left-auto md:top-0 md:right-0 md:w-[480px] md:rounded-none md:shadow-modal"
      >
        <div className="flex flex-col gap-1 px-4 pt-2.5 md:px-8 md:pt-7">
          <span className="mx-auto h-1 w-10 rounded-full bg-field-border md:hidden" />
          <span className="mt-3 flex items-baseline justify-between">
            <h2 id="genre-title" className="text-[30px] font-extrabold tracking-[-0.04em]">Your sound</h2>
            <span className="label-mono text-ink-3">{picked.length} of 3</span>
          </span>
          <p className="text-[13px] text-ink-3">Pick up to three. Main styles first, then go deeper.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MAIN_GENRES.map((g) => {
              const on = picked.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(g)}
                  className={`h-[38px] rounded-full px-3.5 text-[14px] font-semibold disabled:opacity-40 ${on ? "bg-ink text-night-t1" : "chip border-[1.2px] border-ink"}`}
                >
                  {on ? `✓ ${g}` : g}
                </button>
              );
            })}
          </div>
          <label className="mt-4 flex h-12 items-center gap-2.5 rounded-full bg-surface px-3.5 text-[15px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search genres"
              aria-label="Search genres"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
            />
          </label>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-8">
          {groups.map(({ group, items }) => (
            <fieldset key={group} className="mt-3.5">
              <legend className="label-mono text-ink-3">{group}</legend>
              <ul className="mt-1.5">
                {items.map(({ name }) => {
                  const on = picked.includes(name);
                  return (
                    <li key={name}>
                      <label className={`row-hover flex h-12 cursor-pointer items-center justify-between border-t border-line-soft text-[15px] ${on ? "font-semibold" : ""} ${!on && full ? "cursor-not-allowed opacity-40" : ""}`}>
                        {name}
                        <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(name)} className="h-5 w-5 accent-ink" />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
          {groups.length === 0 && <p className="mt-6 text-[14px] text-ink-3">Nothing found. Try a broader style, more genres come later.</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-bg p-4 md:px-8">
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{picked.length ? picked.join(" · ") : "Nothing picked yet"}</span>
          <button
            type="button"
            onClick={() => {
              onDone(picked);
              close();
            }}
            className="cta flex h-[52px] items-center gap-5 rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta"
          >
            Done <span aria-hidden className="cta-arrow">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
