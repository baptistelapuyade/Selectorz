import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Rounds } from "@/components/home/rounds";
import { ShareStory } from "@/components/home/share-story";
import type { Round } from "@/lib/chains";
import { fromServer, type EditState } from "@/lib/edit/model";
import { lookTokens, photoUrl } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home · Selectorz" };

// Home (M1cHome): links die eigene Seite mit Status, rechts die Rounds (Ketten, M2).
async function Content() {
  await connection(); // Sitzung prüfen heißt: pro Request (Cache Components)
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login?next=/home");
  const [{ data }, { data: rounds }] = await Promise.all([supabase.rpc("my_profile"), supabase.rpc("my_rounds")]);
  const list = (rounds as Round[] | null) ?? [];
  const st = data ? fromServer(data) : null;
  const first = (st?.draft.display_name ?? "").split(" ")[0];
  return (
    <>
      <h1 className="border-b-2 border-ink pb-6 text-[56px] font-extrabold leading-[0.86] tracking-[-0.06em] md:pb-7 md:text-[84px]">
        Hi{first ? ` ${first}` : ""}.
      </h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[340px_minmax(0,1fr)] md:gap-12">
        <aside className="flex flex-col gap-3.5">
          <span className="label-mono pt-3.5 text-ink-3">Your page</span>
          {st ? <PageCard st={st} /> : <NoPage />}
        </aside>
        {list.length ? <Rounds rounds={list} /> : <NoRounds />}
      </div>
    </>
  );
}

function PageCard({ st }: { st: EditState }) {
  const d = st.draft;
  const t = lookTokens(d.look, d.accent);
  const src = photoUrl(d.photo_path, d.look, d.photo_style);
  const live = st.status === "published";
  const changes = live && st.changed;
  const chip = !live ? "OFFLINE" : changes ? "LIVE · CHANGES" : "LIVE";
  const dot = !live ? "#8A8A86" : changes ? "#F0532A" : "#2E8B57";
  const line = !live
    ? "Your link shows “No page here.” Publish again from the editor to go back online."
    : changes
      ? "You have changes that are only in your draft. Your public page still shows the old version."
      : `Up to date.${st.published_at ? ` Last published ${new Date(st.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : ""}`;
  return (
    <section className="flex flex-col overflow-hidden rounded-[18px] bg-surface" aria-label="Your page">
      <span className="relative block h-[230px]" style={{ background: t.htBg, opacity: live ? 1 : 0.45 }}>
        {src && d.photo_style === "bw" ? (
          // eslint-disable-next-line @next/next/no-img-element -- fertiges Bild aus dem Speicher
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : src ? (
          <span className="absolute inset-0" style={{ background: t.htDot, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "cover", maskSize: "cover", WebkitMaskPosition: "center", maskPosition: "center" }} />
        ) : null}
        <span className="absolute left-3.5 top-3 flex h-6 items-center gap-1.5 rounded-full bg-ink px-2.5 font-mono text-[10px] tracking-[0.08em] text-night-t1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
          {chip}
        </span>
      </span>
      <span className="flex flex-col gap-3.5 p-5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[28px] font-extrabold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere]">{d.display_name}</span>
          <span className="truncate text-[14px] text-ink-3">selectorz.art/{st.handle}</span>
        </span>
        <span className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.4] text-ink-2" style={{ background: changes ? "#FBEFEA" : "#F4F4F1" }}>
          <span className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: dot }} />
          <span data-testid="page-status">{line}</span>
        </span>
        <Link href="/edit" className={`cta flex h-[52px] items-center justify-between rounded-full bg-ink px-5 text-[15px] font-semibold text-night-t1 ${live && !changes ? "" : "shadow-cta"}`}>
          {!live ? "Edit and publish again" : changes ? "Finish and publish" : "Edit my page"} <span aria-hidden className="cta-arrow">→</span>
        </Link>
        <span className="grid grid-cols-2 gap-2">
          <ShareStory
            disabled={!live}
            story={{
              handle: st.handle,
              displayName: d.display_name,
              genres: d.genres,
              plays: d.plays,
              look: d.look,
              accent: d.accent,
              photo: !d.photo_path
                ? null
                : d.photo_style === "bw"
                  ? { style: "bw", bw: photoUrl(d.photo_path, d.look, "bw") ?? "" }
                  : { style: "dots", day: photoUrl(d.photo_path, "day", "dots") ?? "", night: photoUrl(d.photo_path, "night", "dots") ?? "" },
            }}
          />
          {live ? (
            <a href={`/${st.handle}`} target="_blank" rel="noopener" className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-ink text-[14px] font-semibold hover:bg-ink hover:text-night-t1">
              View page ↗
            </a>
          ) : (
            <span aria-disabled="true" className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-ink text-[14px] font-semibold opacity-40">View page ↗</span>
          )}
        </span>
      </span>
    </section>
  );
}

function NoPage() {
  return (
    <section className="flex flex-col gap-4 rounded-[18px] bg-surface p-5">
      <span className="text-[24px] font-extrabold leading-tight tracking-[-0.035em]">No page yet.</span>
      <span className="text-[14px] leading-[1.45] text-ink-2">Paste one link and get the first version of your DJ page in about a minute.</span>
      <Link href="/start" className="cta flex h-[52px] items-center justify-between rounded-full bg-ink px-5 text-[15px] font-semibold text-night-t1 shadow-cta">
        Make your page <span aria-hidden className="cta-arrow">→</span>
      </Link>
    </section>
  );
}

// Noch keine Runde: leerer Zustand groß an seinem Platz (PO-Feedback 23.11.)
function NoRounds() {
  const steps = [
    ["01", "#8C93FF", "Pick a track", "Paste a link. Add a line about why it's the one."],
    ["02", "#F0532A", "Pass it on", "Send the link to a DJ. They answer with track 2."],
    ["03", "#E4F45A", "Six, then a mix", "The finished chain lands on both your pages."],
  ];
  return (
    <section className="flex flex-col gap-3.5" aria-labelledby="rounds-title">
      <span className="flex justify-between pt-3.5">
        <span id="rounds-title" className="label-mono text-ink-3">Your rounds</span>
        <span className="label-mono text-ink-3">None yet</span>
      </span>
      <article className="flex flex-col gap-8 rounded-[22px] bg-night-bg p-6 text-night-t1 md:p-11">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_300px] md:items-end md:gap-10">
          <span className="flex flex-col gap-3.5">
            <span className="label-mono text-lime">Track chains</span>
            <span className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.055em] md:text-[64px]">Six tracks.<br />Two selectors.</span>
            <span className="max-w-[520px] text-[16px] leading-[1.45] text-night-t2 md:text-[17px]">
              You pick a track, a DJ you rate answers with the next one. Back and forth until six. Then press it into a mix.
            </span>
          </span>
          <span className="flex flex-col gap-3.5">
            <span className="grid grid-cols-6 gap-[5px]" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="h-2.5 rounded-full" style={{ background: i === 0 ? "#8C93FF" : "#34343A" }} />
              ))}
            </span>
            <Link href="/chain/new" className="cta flex h-[60px] items-center justify-between rounded-full bg-night-t1 px-6 text-[17px] font-semibold text-ink">
              Start your first chain <span aria-hidden className="cta-arrow">→</span>
            </Link>
          </span>
        </div>
        <ol className="grid gap-6 border-t border-night-line pt-6 md:grid-cols-3">
          {steps.map(([n, c, title, text]) => (
            <li key={n} className="flex flex-col gap-2">
              <span className="flex h-6 items-center self-start rounded-full px-2 font-mono text-[11px] font-semibold text-ink" style={{ background: c }}>{n}</span>
              <span className="text-[17px] font-semibold">{title}</span>
              <span className="text-[14px] leading-[1.4] text-night-t2">{text}</span>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex h-14 items-center gap-4 border-b border-line px-4 md:h-[72px] md:gap-7 md:px-10">
        <Link href="/" className="text-[18px] font-extrabold tracking-[-0.03em] md:text-[26px] md:tracking-[-0.045em]">Selectorz</Link>
        <nav className="hidden gap-1 md:flex" aria-label="Main">
          <span aria-current="page" className="flex h-[38px] items-center rounded-full bg-ink px-4 text-[14px] font-semibold text-night-t1">Your rounds</span>
          <Link href="/edit" className="flex h-[38px] items-center rounded-full px-4 text-[14px] font-semibold hover:bg-line-soft">My page</Link>
          <Link href="/settings" className="flex h-[38px] items-center rounded-full px-4 text-[14px] font-semibold hover:bg-line-soft">Settings</Link>
        </nav>
        <span className="ml-auto flex items-center gap-3">
          <Link href="/chain/new" className="cta hidden h-10 items-center gap-3 rounded-full bg-ink px-5 text-[14px] font-semibold text-night-t1 shadow-cta md:flex">
            Start a new chain <span aria-hidden className="cta-arrow">→</span>
          </Link>
          <Link href="/settings" className="link-hover text-[14px] font-semibold underline underline-offset-4 md:hidden">Settings</Link>
          <form action="/auth/signout" method="post">
            <button className="h-10 rounded-full border-[1.5px] border-ink px-5 text-[14px] font-semibold hover:bg-ink hover:text-night-t1">Log out</button>
          </form>
        </span>
      </header>
      <div className="flex flex-col gap-0 px-4 py-8 md:px-20 md:py-10">
        <Suspense fallback={<div className="h-[600px]" />}>
          <Content />
        </Suspense>
      </div>
    </main>
  );
}
