import Link from "next/link";

// Rechtliche Links auf jeder Seite, höchstens ein Klick entfernt (§ 5 DDG).
export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-4 text-[13px] text-ink-3 md:px-20">
      <span className="font-extrabold text-ink">Selectorz</span>
      <span className="label-mono">Alpha</span>
      <nav className="ml-auto flex gap-5">
        <Link href="/imprint" className="hover:text-ink hover:underline">Imprint</Link>
      </nav>
    </footer>
  );
}
