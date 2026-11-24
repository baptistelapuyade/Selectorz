"use client";

import { ADDABLE, MAX_SECTIONS, type EditSection, type Kind } from "@/lib/edit/model";
import { SECTION_TITLES } from "@/lib/profile";
import { Panel } from "./panel";

type Props = { sections: EditSection[]; onAdd: (k: Kind) => void; onClose: () => void };

// Section hinzufügen (M1cAddSection). Typen, die schon da sind, sind markiert; höchstens 8.
export function AddSectionPanel({ sections, onAdd, onClose }: Props) {
  const full = sections.length >= MAX_SECTIONS;
  return (
    <Panel title="Add a section" onClose={onClose} note={`${sections.length} of ${MAX_SECTIONS} sections`}>
      {full && <p role="alert" className="rounded-s border-[1.5px] border-error-border bg-[#FBE9E4] p-3 text-[14px] font-semibold text-error-text">Your page has 8 sections. Remove one to add another.</p>}
      <ul className="flex flex-col gap-2">
        {ADDABLE.map(({ kind, desc }) => {
          const has = sections.some((s) => s.kind === kind);
          return (
            <li key={kind}>
              <button
                type="button"
                disabled={full || has}
                onClick={() => onAdd(kind)}
                className="row-hover flex w-full items-center gap-3 rounded-l bg-surface px-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[16px] font-semibold">{SECTION_TITLES[kind]}</span>
                  <span className="text-[13px] text-ink-3">{desc}</span>
                </span>
                {has ? <span className="label-mono flex-none text-ink-3">On your page</span> : <span aria-hidden className="text-[20px]">+</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
