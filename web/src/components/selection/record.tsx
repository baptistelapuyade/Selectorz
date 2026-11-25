import { firstName, type Photo } from "@/lib/chains";
import { photoUrl } from "@/lib/profile";
import { palette, stampFor, type SelPerson } from "@/lib/selection";

// Platte mit Hülle wie eine Split-EP (Boards DeskChainComplete3, ChainComplete3): links und rechts die Profilfotos
// als Punktraster in der Personenfarbe auf Schwarz, Namen oben, Titel unten. Label der Platte in beiden Farben.
// Gleiche Akzentfarbe: White label mit Stempel.
export function Record({ id, title, people, tracks, className = "" }: { id: string; title: string; people: (SelPerson & { photo?: Photo })[]; tracks: number; className?: string }) {
  const col = palette(people);
  const a = people.find((p) => p.role === "A");
  const b = people.find((p) => p.role === "B");
  const pair = `${firstName(a?.name ?? "")} × ${firstName(b?.name ?? "")}`;
  const ground = col.white ? "#F4F4F1" : "#0B0B0C";
  const fg = col.white ? "#111111" : "#F2F2F0";
  return (
    <div className={`relative aspect-square ${className}`} aria-label={`${title}, a selection by ${pair}`} role="img">
      {/* Platte: gleitet beim Abschluss heraus */}
      <div className="done-disc absolute left-[4%] top-[6%] aspect-square w-[92%] rounded-full shadow-[0_30px_60px_rgba(0,0,0,0.5),inset_0_0_0_1px_#2a2a2e]"
        style={{ background: "repeating-radial-gradient(circle at center, #161618 0px, #161618 2px, #0F0F11 3px, #0F0F11 5px)" }}>
        <div className="absolute inset-[33%] flex flex-col items-center justify-center gap-[3px] overflow-hidden rounded-full text-center text-night-bg md:gap-1.5"
          style={{ background: col.white ? "#F4F4F1" : `linear-gradient(90deg, ${col.A} 50%, ${col.B} 50%)` }}>
          {col.white ? <span className="font-mono text-[6px] tracking-[0.12em] md:text-[7px]">WHITE LABEL</span>
            : <span className="hidden font-mono text-[7px] tracking-[0.12em] md:block">SELECTORZ · {tracks} TRACKS</span>}
          <span className="line-clamp-2 px-[12%] text-[13px] font-extrabold leading-[0.9] tracking-[-0.03em] md:text-[20px] md:tracking-[-0.04em]">{title}</span>
          <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-night-bg md:h-[9px] md:w-[9px]" />
          <span className="font-mono text-[6px] tracking-[0.12em] md:text-[7px]">{pair.toUpperCase()}</span>
          {col.white && <span className="mt-0.5 -rotate-6 border border-ink px-1 font-mono text-[6px] tracking-[0.1em] md:text-[7px]">{stampFor(id)}</span>}
        </div>
      </div>
      {/* Hülle: zwei Fotos nebeneinander */}
      <figure className="done-sleeve absolute inset-0 m-0 overflow-hidden rounded-[3px] shadow-[0_30px_60px_rgba(0,0,0,0.45)] md:shadow-[0_40px_80px_rgba(0,0,0,0.5)]" style={{ background: ground, color: fg }}>
        <Half p={a} color={col.white ? "#111111" : col.A} ground={ground} side="left" />
        <Half p={b} color={col.white ? "#111111" : col.B} ground={ground} side="right" />
        <span aria-hidden className="absolute inset-y-0 left-[calc(50%-1px)] w-[2px]" style={{ background: ground }} />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: `linear-gradient(180deg, ${ground}00 0%, ${ground}EB 62%)` }} />
        <span className="label-mono absolute inset-x-3 top-3 flex justify-between gap-2 md:inset-x-[18px] md:top-4">
          <span className="truncate">{(a?.name ?? "").toUpperCase()}</span>
          <span className="truncate text-right">{(b?.name ?? "").toUpperCase()}</span>
        </span>
        {col.white && <span className="absolute right-3 top-10 -rotate-6 border-2 border-ink px-2 py-0.5 font-mono text-[11px] tracking-[0.12em] md:right-[18px] md:top-12">{stampFor(id)}</span>}
        <span className="absolute bottom-3 left-3 right-3 line-clamp-3 text-[44px] font-extrabold leading-[0.84] tracking-[-0.06em] [overflow-wrap:anywhere] md:bottom-[18px] md:left-[18px] md:right-[18px] md:text-[68px]">{title}</span>
      </figure>
    </div>
  );
}

// Eine Hälfte: Punktraster (Maske) in der Personenfarbe, Schwarz-Weiß-Foto oder ohne Foto ein Punktfeld
function Half({ p, color, ground, side }: { p?: SelPerson & { photo?: Photo }; color: string; ground: string; side: "left" | "right" }) {
  const ph = p?.photo ?? null;
  const pos = side === "left" ? "left-0" : "left-1/2";
  const src = ph ? photoUrl(ph.path, ph.style === "dots" ? "night" : ph.look, ph.style ?? undefined) : null;
  if (src && ph?.style === "bw")
    // eslint-disable-next-line @next/next/no-img-element -- fertiges Schwarz-Weiß-Bild aus dem Speicher
    return <img src={src} alt="" className={`absolute top-0 h-full w-1/2 object-cover ${pos}`} style={{ objectPosition: side === "left" ? "62% 40%" : "45% 40%" }} />;
  if (src)
    return (
      <span aria-hidden className={`absolute top-0 h-full w-1/2 ${pos}`}
        style={{ background: color, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "cover", maskSize: "cover", WebkitMaskPosition: side === "left" ? "62% 40%" : "45% 40%", maskPosition: side === "left" ? "62% 40%" : "45% 40%" }} />
    );
  return (
    <span aria-hidden className={`absolute top-0 h-full w-1/2 ${pos}`}
      style={{ backgroundColor: ground, backgroundImage: `radial-gradient(${color} 26%, transparent 30%)`, backgroundSize: "11px 11px", opacity: 0.85 }} />
  );
}
