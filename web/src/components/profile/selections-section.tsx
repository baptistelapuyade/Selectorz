import Link from "next/link";
import { firstName } from "@/lib/chains";
import { palette, selectionPath, selectionTitle, type ProfileSelection } from "@/lib/selection";

type Tokens = { fg: string; muted: string; surface: string; line2: string };

// Freigegebene Selections auf dem Profil (PUBLISH-06, Board SelectionsTabHouse): Karten mit Link zur Selection-Seite.
// Ohne freigegebene Selection erscheint nichts (keine leere Section auf einer öffentlichen Seite).
export function SelectionsSection({ list, t }: { list: ProfileSelection[]; t: Tokens }) {
  if (!list.length) return null;
  return (
    <section aria-labelledby="sel-title" className="mt-14 px-4 md:mt-16 md:px-0">
      <h2 className="mb-3.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span id="sel-title" className="text-[26px] font-extrabold tracking-[-0.035em] md:text-[30px]">Selections</span>
        <span className="font-mono text-[10px] tracking-[0.1em] md:text-[11px]" style={{ color: t.muted }}>PICKED BACK AND FORTH</span>
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 md:grid-cols-3">
        {list.map((s) => {
          const [a, b] = s.me.role === "A" ? [s.me, s.other] : [s.other, s.me];
          const col = palette([a, b]);
          return (
            <li key={s.id}>
              <Link href={selectionPath(s.id)} className="flex h-full flex-col gap-3 rounded-[12px] p-4 hover:opacity-90" style={{ background: t.surface, boxShadow: `0 0 0 1px ${t.line2}` }} data-testid="profile-selection">
                <span className="grid grid-cols-6 gap-1" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className="h-1.5 rounded-full" style={{ background: i % 2 ? col.B : col.A, outline: col.white ? `1px solid ${t.fg}` : undefined }} />
                  ))}
                </span>
                <span className="text-[24px] font-extrabold leading-[0.95] tracking-[-0.045em] [overflow-wrap:anywhere]">{selectionTitle(s, a.name, b.name)}</span>
                <span className="text-[14px]" style={{ color: t.muted }}>with {s.other.name}</span>
                <ol className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px]">
                  {s.tracks.map((x, i) => (
                    <li key={i} className="truncate"><span className="font-mono text-[10px]" style={{ color: t.muted }}>{String(i + 1).padStart(2, "0")}</span> {x.title}</li>
                  ))}
                </ol>
                <span className="mt-auto text-[14px] font-semibold underline underline-offset-4">Open the selection with {firstName(s.other.name)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
