import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Imprint · Selectorz" };

// Anbieterkennzeichnung nach § 5 DDG und § 18 Abs. 2 MStV.
export default function ImprintPage() {
  return (
    <main className="flex flex-1 flex-col gap-10 px-4 py-6 md:px-20 md:py-10">
      <Link href="/" className="text-[18px] font-extrabold tracking-tight">Selectorz</Link>
      <div className="flex max-w-[640px] flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="label-mono text-ink-3">Impressum</span>
          <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[72px]">Imprint</h1>
        </div>
        <section className="flex flex-col gap-1 text-[16px] leading-[1.5]">
          <span className="label-mono pb-2 text-ink-3">Provider</span>
          <address className="not-italic">
            Baptiste Lapuyade
            <br />
            Weserstraße 140
            <br />
            12059 Berlin
            <br />
            Germany
          </address>
        </section>
        <section className="flex flex-col gap-1 text-[16px] leading-[1.5]">
          <span className="label-mono pb-2 text-ink-3">Contact</span>
          <a href="mailto:hello@selectorz.art" className="font-semibold underline underline-offset-4">hello@selectorz.art</a>
        </section>
        <section className="flex flex-col gap-1 text-[16px] leading-[1.5]">
          <span className="label-mono pb-2 text-ink-3">Responsible for content (§ 18 Abs. 2 MStV)</span>
          <p>Baptiste Lapuyade, address as above</p>
        </section>
        <p className="text-[14px] leading-[1.5] text-ink-2">
          Selectorz is in a free test phase (alpha). Music links and embeds point to the platforms where the
          tracks are published; their content belongs to the respective rights holders.
        </p>
      </div>
    </main>
  );
}
