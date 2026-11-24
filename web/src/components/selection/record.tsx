import { firstName } from "@/lib/chains";
import { palette, stampFor, type SelPerson } from "@/lib/selection";

// Platte mit Hülle (Plattenlabel 17.11.2026): Label mit Titel, „A × B“ und „Selectorz · 6 Tracks“, Hälften in den
// Personenfarben. Gleiche Akzentfarbe: White label mit Stempel. Hülle typografisch, ohne Fotos.
export function Record({ id, title, people, tracks, className = "" }: { id: string; title: string; people: SelPerson[]; tracks: number; className?: string }) {
  const col = palette(people);
  const a = people.find((p) => p.role === "A");
  const b = people.find((p) => p.role === "B");
  const pair = `${firstName(a?.name ?? "")} × ${firstName(b?.name ?? "")}`;
  return (
    <div className={`relative aspect-square w-[66%] ${className}`} aria-label={`${title}, a selection by ${pair}`} role="img">
      {/* Platte: gleitet beim Abschluss heraus */}
      <div className="done-disc absolute inset-[3%] rounded-full bg-[#0b0b0c] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: "repeating-radial-gradient(circle, #141416 0 2px, #0b0b0c 2px 5px)" }}>
        <div className="absolute inset-[33%] flex flex-col items-center justify-center overflow-hidden rounded-full text-center text-ink"
          style={{ background: col.white ? "#F4F4F1" : `linear-gradient(90deg, ${col.A} 50%, ${col.B} 50%)` }}>
          {col.white && <span className="font-mono text-[7px] tracking-[0.12em] md:text-[8px]">WHITE LABEL</span>}
          <span className="line-clamp-2 px-[12%] text-[13px] font-extrabold leading-[0.95] tracking-[-0.04em] md:text-[17px]">{title}</span>
          <span className="pt-1 font-mono text-[7px] tracking-[0.1em] md:text-[8px]">{pair.toUpperCase()}</span>
          <span className="font-mono text-[6px] tracking-[0.1em] md:text-[7px]">SELECTORZ · {tracks} TRACKS</span>
          {col.white && (
            <span className="mt-1 -rotate-6 border border-ink px-1 font-mono text-[6px] tracking-[0.1em] md:text-[7px]">{stampFor(id)}</span>
          )}
        </div>
      </div>
      {/* Hülle */}
      <div className="done-sleeve absolute inset-0 flex flex-col justify-between overflow-hidden p-[5%] text-ink shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        style={{ background: col.white ? "#F4F4F1" : `linear-gradient(90deg, ${col.A} 50%, ${col.B} 50%)` }}>
        <span className="flex justify-between font-mono text-[10px] tracking-[0.12em] md:text-[11px]">
          <span>{(a?.name ?? "").toUpperCase()}</span>
          <span className="text-right">{(b?.name ?? "").toUpperCase()}</span>
        </span>
        {col.white && <span className="-rotate-6 self-end border-2 border-ink px-2 py-0.5 font-mono text-[11px] tracking-[0.12em]">{stampFor(id)}</span>}
        <span className="text-[clamp(34px,7vw,76px)] font-extrabold leading-[0.88] tracking-[-0.06em] [overflow-wrap:anywhere]">{title}</span>
      </div>
    </div>
  );
}
