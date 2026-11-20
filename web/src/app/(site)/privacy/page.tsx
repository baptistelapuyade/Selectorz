import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · Selectorz" };

// Entwurf für die Alpha. Vor dem offiziellen Start rechtlich prüfen lassen.
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Who is responsible",
    body: (
      <>
        Baptiste Lapuyade, Weserstraße 140, 12059 Berlin, Germany ·{" "}
        <a className="underline underline-offset-4 link-hover" href="mailto:hello@selectorz.art">hello@selectorz.art</a>. Selectorz is in a free
        test phase (alpha).
      </>
    ),
  },
  {
    title: "Cookies",
    body: (
      <>
        We set only the cookies needed to keep you logged in. No advertising or tracking cookies, so there is no cookie banner. Legal
        basis: § 25 (2) TDDDG, Art. 6 (1) (b) GDPR.
      </>
    ),
  },
  {
    title: "Your account and login",
    body: (
      <>
        To log in we need your email address. We send you a one-time code and store your account, your page and your rounds. Hosted by
        Supabase in Frankfurt (EU). Legal basis: Art. 6 (1) (b) GDPR, to provide the service you asked for. When you delete your account,
        your login and page are deleted right away; tracks you added to someone else&apos;s round stay there without your name.
      </>
    ),
  },
  {
    title: "Emails",
    body: (
      <>
        Login codes and round notifications are sent through Resend (sending region EU, Ireland). Resend, Inc. is based in the USA and
        certified under the EU-US Data Privacy Framework. You can turn off round emails in Settings.
      </>
    ),
  },
  {
    title: "Hosting and server logs",
    body: (
      <>
        The website runs on Vercel (servers in Frankfurt). When you open a page, technical data such as IP address, time and browser is
        processed to deliver the page and keep it secure, and kept briefly in server logs. Vercel Inc. is based in the USA and certified
        under the EU-US Data Privacy Framework. Legal basis: Art. 6 (1) (f) GDPR.
      </>
    ),
  },
  {
    title: "Visitor statistics",
    body: (
      <>
        We count visits and steps (for example “page published”) with PostHog, hosted in Frankfurt (EU). Without cookies and without
        storing anything in your browser; IP addresses are dropped, page addresses are cut before the “?”. We can&apos;t recognise you
        across days. No session recordings. Legal basis: Art. 6 (1) (f) GDPR, to see whether Selectorz works. You can object anytime
        by email.
      </>
    ),
  },
  {
    title: "Feedback",
    body: (
      <>
        If you send feedback, we store your note, the page you were on and your browser type, plus your account if you are logged in.
        It is emailed to Baptiste. We contact you only if you ticked the box. Notes are deleted at the latest one year after the alpha
        ends. Legal basis: Art. 6 (1) (f) GDPR.
      </>
    ),
  },
  {
    title: "Our mailbox",
    body: <>Emails you send us arrive at our mailbox hosted by united-domains GmbH, Germany.</>,
  },
  {
    title: "Music players",
    body: (
      <>
        Players from SoundCloud, YouTube, Mixcloud or Bandcamp load only after you tap to allow it. Until then nothing is sent to them.
        Once loaded, their own privacy policies apply.
      </>
    ),
  },
  {
    title: "Your rights",
    body: (
      <>
        You can ask what we store about you, have it corrected or deleted, restrict or object to processing, and get your data in a
        common format. Write to hello@selectorz.art. You can also complain to a data protection authority, for example the Berliner
        Beauftragte für Datenschutz und Informationsfreiheit.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col gap-10 px-4 py-6 md:px-20 md:py-10">
      <Link href="/" className="text-[18px] font-extrabold tracking-tight">Selectorz</Link>
      <div className="flex max-w-[680px] flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="label-mono text-ink-3">Datenschutz · Stand 19.11.2026</span>
          <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[72px]">Privacy</h1>
          <p className="text-[16px] leading-[1.5] text-ink-2">Short version: we keep as little as we can, store it in the EU, and never sell it.</p>
        </div>
        {SECTIONS.map((s) => (
          <section key={s.title} className="flex flex-col gap-2 border-t-2 border-ink pt-4">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{s.title}</h2>
            <p className="text-[15px] leading-[1.55] text-ink-2">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
