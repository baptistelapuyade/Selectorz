"use client";

import { useState } from "react";
import { useGigToday } from "@/components/use-gig-today";
import { gigDate, linkLabel, untilLabel, upcoming, type Gig } from "@/lib/gigs";

type Tokens = { fg: string; bg: string; muted: string; surface: string; line2: string };

const GLOW = "drop-shadow(-6px 0 14px rgba(140,147,255,0.5)) drop-shadow(6px 0 14px rgba(240,83,42,0.4))";

// Kerben am Abriss: echt ausgestanzt (Maske), nie ein Kreis in Hintergrundfarbe darüber (PO-Feedback 23.11.)
const cut = (x: number) => {
  const m = `radial-gradient(circle at ${x}px 0, transparent 9px, #000 9.5px), radial-gradient(circle at ${x}px 100%, transparent 9px, #000 9.5px)`;
  return { WebkitMaskImage: m, WebkitMaskComposite: "source-in", maskImage: m, maskComposite: "intersect" } as React.CSSProperties;
};

// „Next gigs“ auf dem Profil (Variante B2): Tickets quer, der nächste invertiert mit Glow; die nächsten 3, Rest aufklappbar.
export function GigsSection({ gigs, name, t, onEdit }: { gigs: Gig[]; name: string; t: Tokens; onEdit?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const today = useGigToday();
  const list = today ? upcoming(gigs, today) : [...gigs].sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return null;
  const shown = open ? list : list.slice(0, 3);
  const more = list.length - 3;
  return (
    <section aria-labelledby="gigs-title" className="mt-12 px-4 md:mt-14 md:px-0">
      <h2 className="mb-3.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span id="gigs-title" className="text-[26px] font-extrabold tracking-[-0.035em] md:text-[30px]">Next gigs</span>
        <span className="font-mono text-[10px] tracking-[0.1em] md:text-[11px]" style={{ color: t.muted }}>WHERE TO HEAR {name.split(" ")[0].toUpperCase()}</span>
        <span className="ml-auto flex items-center gap-3">
          {onEdit}
          {more > 0 && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-[15px] font-semibold underline underline-offset-4">
              {open ? "Show less" : `+ ${more} more`}
            </button>
          )}
        </span>
      </h2>
      <ol className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 md:grid-cols-3">
        {shown.map((g, i) => {
          const next = i === 0;
          const d = gigDate(g.date);
          const label = linkLabel(g.url);
          return (
            <li key={g.id} style={{ filter: next ? GLOW : `drop-shadow(0 0 0.6px ${t.muted})` }}>
              <div
                className="grid h-[112px] grid-cols-[96px_minmax(0,1fr)] rounded-[12px] md:h-[128px]"
                style={{ background: next ? t.fg : t.surface, color: next ? t.bg : t.fg, ...cut(96) }}
              >
                <span className="flex flex-col items-center justify-center gap-0.5 border-r-[1.5px] border-dashed" style={{ borderColor: next ? "rgba(127,127,127,0.45)" : t.line2 }}>
                  <span className="font-mono text-[10px] tracking-[0.12em] opacity-70">{d.wd}</span>
                  <span className="text-[36px] font-extrabold leading-[0.95] tracking-[-0.05em] md:text-[40px]">{d.day}</span>
                  <span className="font-mono text-[11px] tracking-[0.1em]">{d.mon}</span>
                </span>
                <span className="flex min-w-0 flex-col justify-between px-4 py-3.5 md:px-[18px] md:py-4">
                  <span className="flex min-h-[12px] items-center gap-[7px] font-mono text-[10px] tracking-[0.1em] opacity-75">
                    {next && <span className="h-[7px] w-[7px] rounded-full bg-lila" />}
                    {next ? `NEXT${today ? ` · ${untilLabel(g.date, today)}` : ""}` : today ? untilLabel(g.date, today) : ""}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="truncate text-[18px] font-extrabold leading-[1.1] tracking-[-0.025em] md:text-[19px]">{g.event}</span>
                    <span className="flex justify-between gap-3 text-[14px]">
                      <span className="truncate opacity-75">{g.city}</span>
                      {g.url && label && (
                        <a href={g.url} target="_blank" rel="noopener noreferrer" className="flex-none font-semibold underline underline-offset-[3px]">
                          {label} ↗
                        </a>
                      )}
                    </span>
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
