"use client";

import Link from "next/link";
import { firstName, ROLE_COLOR, type Entry, type Invite, type Role } from "@/lib/chains";
import { Cta, PlayButton, PlayFrame, PlayProvider } from "./ui";

// Fehlerseiten der Ketten (Boards DeskErrTaken3/ErrTaken2, DeskErrRevoked, DeskErrEnded)
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const ghost = "flex h-[52px] items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-ink px-[22px] text-[15px] font-semibold hover:bg-ink hover:text-night-t1";

function Shell({ label, children, footer, note }: { label: string; children: React.ReactNode; footer: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <header className="border-b-0 md:border-b md:border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-4 md:h-[72px] md:px-10">
          <Link href="/" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[26px] md:tracking-[-0.045em]">Selectorz</Link>
          <span className="label-mono text-ink-3"><span className="md:hidden">{label}</span><span className="hidden md:inline">SELECTORZ.COM</span></span>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 content-start gap-6 px-4 pb-6 pt-[18px] md:grid-cols-[minmax(0,1fr)_minmax(0,560px)] md:content-center md:items-center md:gap-20 md:px-20 md:py-12">
        {children}
      </main>
      <footer className="mt-auto md:border-t md:border-line">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 pb-6 pt-[18px] md:h-[104px] md:flex-row md:items-center md:justify-between md:gap-6 md:px-20 md:py-0">
          <span className="hidden text-[14px] leading-[1.4] text-ink-2 md:block">{note}</span>
          <span className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:gap-3.5">{footer}</span>
        </div>
      </footer>
    </div>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => <span className="label-mono hidden text-ink-3 md:block">{children}</span>;
const H1 = ({ children, size = "md:text-[96px]" }: { children: React.ReactNode; size?: string }) => (
  <h1 className={`text-[46px] font-extrabold leading-[0.88] tracking-[-0.05em] [overflow-wrap:anywhere] md:leading-[0.86] md:tracking-[-0.06em] ${size}`}>{children}</h1>
);
const Text = ({ children }: { children: React.ReactNode }) => <p className="max-w-[560px] text-[15px] leading-[1.45] text-ink-2 md:text-[19px]">{children}</p>;

// Runde beendet: im Raum (beide) und über eine alte Einladung
export function Ended({ name, count, target, entries }: { name: string | null; count: number; target: number; entries: { role: Role }[] }) {
  const kept = count === 1 ? "The track you picked stays here." : `The ${WORDS[count] ?? count} you picked together stay here for both of you.`;
  return (
    <Shell label={`ENDED AT ${count} OF ${target}`} footer={<><Link href="/home" className={ghost}>Back to your rounds</Link><Cta href="/chain/new">Start a new chain</Cta></>}>
      <div className="flex flex-col gap-4 md:gap-5">
        <Eyebrow>ROUND ENDED AT {count} OF {target}</Eyebrow>
        <H1>{name ? `${name} ended this round.` : "You ended this round."}</H1>
        <Text>No more tracks can be added. {kept}</Text>
      </div>
      <div aria-hidden>
        <span className="grid h-[180px] items-end gap-2 md:h-[300px] md:gap-2.5" style={{ gridTemplateColumns: `repeat(${target}, minmax(0, 1fr))` }}>
          {Array.from({ length: target }, (_, i) => (
            <span key={i} className="rounded-[12px]" style={{ height: `${40 + (50 * i) / Math.max(1, target - 1)}%`, background: entries[i] ? ROLE_COLOR[entries[i].role] : "var(--color-line)" }} />
          ))}
        </span>
        <span className="label-mono mt-3.5 flex justify-between text-ink-3">
          <span>{Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, "0")).join(" · ")} KEPT</span>
          <span>{count} OF {target}</span>
        </span>
      </div>
    </Shell>
  );
}

// Einladung ersetzt oder abgelaufen
export function Revoked({ invite, token }: { invite: Invite; token: string }) {
  const host = firstName(invite.creator_name);
  return (
    <Shell label="INVITE EXPIRED"
      footer={<>
        <Link href="/start" className={ghost}>Make your own DJ page</Link>
        {invite.creator_handle ? <Cta href={`/${invite.creator_handle}`}>See {host}’s page</Cta> : <Cta href="/chain/new">Start your own chain</Cta>}
      </>}>
      <div className="flex flex-col gap-4 md:gap-5">
        <Eyebrow>INVITE REPLACED OR EXPIRED</Eyebrow>
        <H1>This link doesn’t work anymore.</H1>
        <Text>{host} made a new invite or the old one ran out. Ask {host} to send you the new link.</Text>
      </div>
      <div aria-hidden>
        <span className="box-border flex h-[120px] items-center gap-4 rounded-[16px] border-2 border-dashed border-[#9A9A96] px-6 md:h-[220px] md:gap-5 md:px-8">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-none text-ink-3">
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /><path d="M4 4l16 16" />
          </svg>
          <span className="min-w-0 truncate font-mono text-[16px] text-ink-3 line-through md:text-[22px]">selectorz.com/i/{token.slice(0, 5)}</span>
        </span>
      </div>
    </Shell>
  );
}

// Einladung schon vergeben: zwei DJs spielen, eigene Kette starten
export function Taken({ invite }: { invite: Invite }) {
  const host = firstName(invite.creator_name);
  const partner = invite.partner_name || "someone";
  const page = invite.creator_handle ? `/${invite.creator_handle}` : null;
  const steps = [
    ["01", "Pick your first track", "Paste a SoundCloud link, or any track you love."],
    ["02", "Send the link to one DJ", "WhatsApp, Instagram, wherever you talk."],
    ["03", `${invite.target === 6 ? "Six" : WORDS[invite.target] ?? invite.target} tracks, back and forth`, "Then press it into a mix if you like."],
  ];
  const first: Entry = { position: 1, role: "A", title: invite.track_title, artist: invite.track_artist, url: invite.track_url, comment: "", created_at: "" };
  const tile = (name: string, color: string) => (
    <span className="box-border flex h-[52px] w-[52px] items-end rounded-[10px] p-1.5 text-[18px] font-extrabold leading-[0.8] tracking-[-0.05em] md:h-16 md:w-16 md:rounded-[12px] md:p-2 md:text-[22px]" style={{ background: color }}>{initials(name)}</span>
  );
  return (
    <PlayProvider>
      <Shell label="INVITE ALREADY TAKEN"
        note={page ? `When ${host} and ${partner} finish and share it, their selection shows up on ${host}’s page.` : undefined}
        footer={page ? <Link href={page} className={`${ghost} hidden md:flex`}>See {host}’s page</Link> : null}>
        <div className="flex flex-col gap-4 md:gap-5">
          <Eyebrow>INVITE ALREADY TAKEN</Eyebrow>
          <span className="flex gap-2 md:gap-2.5" aria-hidden>
            {tile(invite.creator_name, invite.creator_color ?? ROLE_COLOR.A)}
            {tile(invite.partner_name || "?", invite.partner_color ?? ROLE_COLOR.B)}
          </span>
          <H1 size="md:text-[88px]">Someone got here first.</H1>
          <Text>{host} and {partner} are already playing. Each round is for two DJs. But you can start your own, right now.</Text>
          <span className="mt-0.5 flex max-w-[520px] flex-col border-t border-chip-border pt-3 md:mt-2 md:pt-4">
            <span className="flex items-center gap-3 md:gap-3.5">
              <PlayButton id="taken" url={first.url} title={first.title} />
              <span className="flex min-w-0 flex-col gap-0.5 md:gap-[3px]">
                <span className="label-mono text-ink-3 md:text-[10px]">{host.toUpperCase()} STARTED WITH</span>
                <span className="text-[15px] font-semibold md:text-[17px]">{first.title} {first.artist && <span className="font-normal text-ink-3">· {first.artist}</span>}</span>
              </span>
            </span>
            <PlayFrame id="taken" url={first.url} title={first.title} />
          </span>
        </div>
        <div className="flex flex-col gap-3 md:gap-[22px]">
          <section className="flex flex-col gap-2 rounded-[18px] bg-surface px-5 pb-1.5 pt-5 md:gap-3.5 md:rounded-[22px] md:px-8 md:pb-3.5 md:pt-[30px]">
            <h2 className="text-[30px] font-extrabold leading-[0.9] tracking-[-0.045em] md:text-[48px] md:leading-[0.88] md:tracking-[-0.05em]">Start your own chain.</h2>
            <ol className="mt-1 md:mt-1.5">
              {steps.map(([n, t, d]) => (
                <li key={n} className="grid grid-cols-[34px_minmax(0,1fr)] items-baseline gap-2.5 border-t border-line-soft py-3.5 md:grid-cols-[48px_minmax(0,1fr)] md:gap-4 md:py-[18px]">
                  <span className="label-mono text-ink-3">{n}</span>
                  <span className="flex flex-col gap-[3px] md:gap-1">
                    <span className="text-[17px] font-semibold md:text-[20px] md:tracking-[-0.01em]">{t}</span>
                    <span className="text-[13px] leading-[1.4] text-ink-3 md:text-[14px]">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <span className="mt-3 flex flex-col gap-3 md:mt-0 md:gap-[22px]">
            <Link href="/chain/new" className="cta flex h-[62px] items-center justify-between rounded-full bg-ink px-[26px] text-[17px] font-semibold text-night-t1 shadow-cta md:h-[66px] md:px-[30px] md:text-[18px]">
              Start your own chain <span aria-hidden className="cta-arrow">→</span>
            </Link>
            {page && (
              <span className="flex flex-wrap justify-center gap-2 text-[13px] text-ink-2 md:text-[14px]">
                Rather play with {host}? <Link href={page} className="link-hover font-semibold text-ink underline underline-offset-[3px]">Ask {host} for a round</Link>
              </span>
            )}
          </span>
        </div>
      </Shell>
    </PlayProvider>
  );
}

// Link gibt es nicht
export function NotFound() {
  return (
    <Shell label="INVITE NOT FOUND" footer={<><Link href="/" className={ghost}>What’s Selectorz?</Link><Cta href="/chain/new">Start your own chain</Cta></>}>
      <div className="flex flex-col gap-4 md:gap-5">
        <Eyebrow>INVITE NOT FOUND</Eyebrow>
        <H1>This invite doesn’t exist.</H1>
        <Text>Check the link, or ask for a new one.</Text>
      </div>
    </Shell>
  );
}
