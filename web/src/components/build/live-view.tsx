"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/components/analytics";
import { storyUrl } from "@/lib/story";
import { drawStory, type StoryData } from "./story-card";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// „You're live.“ (Boards DeskBuildLive/BuildLive): Link kopieren, Story-Karte teilen, nächster Schritt Kette.
export function LiveView({ story }: { story: StoryData }) {
  const url = `https://${storyUrl(story.handle)}`;
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState<{ src: string; blob: Blob } | null>(null);
  const [cardError, setCardError] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    drawStory(story)
      .then((c) => new Promise<Blob | null>((r) => c.toBlob(r, "image/png")))
      .then((blob) => {
        if (gone) return;
        if (!blob) return setCardError(true);
        setCard({ src: URL.createObjectURL(blob), blob });
      })
      .catch(() => !gone && setCardError(true));
    return () => {
      gone = true;
    };
  }, [story]);

  const copyLink = async () => {
    setCopied(await copy(url));
    track("profile_link_copied", { from: "live" });
  };

  // Teilen: Link schon kopieren (für den Sticker), dann Geräte-Dialog mit Bild; sonst Bild speichern (SHARE-11)
  const shareStory = async () => {
    if (!card) return;
    const linkCopied = await copy(url);
    setCopied(linkCopied);
    const file = new File([card.blob], `selectorz-${story.handle}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file] });
        track("story_card_shared", { kind: "profile", via: "share" });
      } else {
        const a = document.createElement("a");
        a.href = card.src;
        a.download = file.name;
        a.click();
        track("story_card_shared", { kind: "profile", via: "download" });
      }
      setShareNote(linkCopied ? "Your link is copied. Add it as a link sticker where the card says so." : `Add a link sticker with ${storyUrl(story.handle)}.`);
    } catch {
      // Teilen abgebrochen: nichts tun
    }
  };

  return (
    <div className="appear flex flex-1 flex-col">
      <main className="grid flex-1 grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-8 md:grid-cols-[minmax(0,1fr)_360px] md:gap-16 md:px-20 md:pt-9">
        <div className="flex flex-col gap-5 md:gap-6">
          <span className="label-mono text-ink-3">{storyUrl(story.handle)} is public</span>
          <h1 className="text-[64px] font-extrabold leading-[0.86] tracking-[-0.06em] md:text-[132px] md:leading-[0.84] md:tracking-[-0.065em]">You&apos;re live.</h1>
          <p className="max-w-[520px] text-[16px] leading-[1.45] text-ink-2 md:text-[18px]">
            Put the link in your bio and share the story card. That&apos;s how people find you.
          </p>
          <div className="flex h-16 max-w-[600px] items-center gap-2.5 rounded-full border-2 border-ink bg-surface pl-5 pr-2">
            <span className="min-w-0 flex-1 truncate text-[17px] font-semibold md:text-[20px]">{storyUrl(story.handle)}</span>
            <button
              type="button"
              onClick={copyLink}
              className={`flex h-12 flex-none items-center rounded-full px-5 text-[15px] font-semibold ${copied ? "bg-ok text-white" : "bg-ink text-night-t1 hover:bg-ink-2"}`}
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
          <Link href={`/${story.handle}`} className="link-hover self-start text-[15px] font-semibold underline underline-offset-4">
            View my page ↗
          </Link>
        </div>

        <div className="flex flex-col items-center gap-3.5">
          {card ? (
            // eslint-disable-next-line @next/next/no-img-element -- im Browser erzeugtes Bild (Blob-URL)
            <img src={card.src} alt="Your story card" width={1080} height={1920} className="h-auto w-[252px] rounded-[14px] shadow-[0_24px_50px_rgba(0,0,0,0.2)]" />
          ) : (
            <span className="flex h-[448px] w-[252px] items-center justify-center rounded-[14px] bg-line-soft text-[13px] text-ink-3">
              {cardError ? "The story card didn't work here." : "Making your story card…"}
            </span>
          )}
          <span className="label-mono text-ink-3">Your story card · {story.look} look</span>
          <button
            type="button"
            disabled={!card}
            onClick={shareStory}
            className="h-[50px] w-[252px] rounded-full border-[1.5px] border-ink text-[15px] font-semibold hover:bg-ink hover:text-night-t1 disabled:opacity-40"
          >
            Share story
          </button>
          {shareNote && <p className="appear max-w-[280px] text-center text-[13px] leading-[1.4] text-ink-2">{shareNote}</p>}
          <ol className="max-w-[300px] text-[13px] leading-[1.4] text-ink-2">
            <li className="flex gap-3 border-t border-line py-2.5"><span className="font-mono text-ink-3">01</span>Share the card to your story or save it.</li>
            <li className="flex gap-3 border-t border-line py-2.5"><span className="font-mono text-ink-3">02</span>Add a link sticker where the card says so. Your link is copied when you share.</li>
          </ol>
        </div>
      </main>

      <section className="mt-6 flex flex-col gap-6 bg-ink px-4 py-10 text-night-t1 md:flex-row md:items-center md:gap-10 md:px-20 md:py-13">
        <span className="label-mono text-night-t2">Next</span>
        <span className="flex flex-1 flex-col gap-3">
          <span className="text-[40px] font-extrabold leading-[0.88] tracking-[-0.055em] md:text-[64px]">Play a round with<br />another DJ.</span>
          <span className="text-[15px] text-night-t2 md:text-[16px]">Pick a track and send the link. Six tracks later you have a joint selection.</span>
        </span>
        {/* Ketten kommen mit M2: Knopf schon an seinem Platz, klar als „bald“ markiert */}
        <span className="flex flex-col gap-2 md:items-end">
          <span role="button" aria-disabled="true" className="flex h-16 cursor-not-allowed items-center gap-3.5 rounded-full bg-night-t1 px-7 text-[16px] font-semibold text-ink opacity-60">
            Start a track chain <span aria-hidden>→</span>
          </span>
          <span className="label-mono text-night-t2">Opens in the next update</span>
        </span>
      </section>
    </div>
  );
}
