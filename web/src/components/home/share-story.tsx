"use client";

import { useEffect, useState } from "react";
import { track } from "@/components/analytics";
import { drawStory, type StoryData } from "@/components/build/story-card";
import { useClosable } from "@/components/use-closable";
import { storyUrl } from "@/lib/story";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// „Share story“ auf Home: dieselbe Story wie nach dem Live-Gehen, jetzt jederzeit.
export function ShareStory({ story, disabled }: { story: StoryData; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-ink text-[14px] font-semibold hover:bg-ink hover:text-night-t1 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
      >
        Share story
      </button>
      {open && <Dialog story={story} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ story, onClose }: { story: StoryData; onClose: () => void }) {
  const { closing, close } = useClosable(onClose);
  const [card, setCard] = useState<{ src: string; blob: Blob } | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const url = `https://${storyUrl(story.handle)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    drawStory(story)
      .then((c) => new Promise<Blob | null>((r) => c.toBlob(r, "image/png")))
      .then((blob) => {
        if (gone) return;
        if (!blob) return setFailed(true);
        made = URL.createObjectURL(blob);
        setCard({ src: made, blob });
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [story]);

  const share = async () => {
    if (!card) return;
    const copied = await copy(url);
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
      setNote(copied ? "Your link is copied. Add it as a link sticker." : `Add a link sticker with ${storyUrl(story.handle)}.`);
    } catch {
      // Teilen abgebrochen
    }
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-end justify-center text-ink md:items-center ${closing ? "closing" : ""}`}>
      <button aria-label="Close" onClick={close} className="scrim absolute inset-0 bg-[rgba(17,17,17,0.6)] active:scale-100" />
      <section role="dialog" aria-modal="true" aria-labelledby="ss-title" className="sheet relative grid max-h-[100dvh] w-full max-w-[880px] grid-cols-1 gap-6 overflow-y-auto rounded-t-[22px] bg-bg p-5 md:grid-cols-[405px_minmax(0,1fr)] md:gap-9 md:rounded-[22px] md:p-8 md:shadow-modal">
        <figure className="m-0 mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[14px] bg-line-soft shadow-[0_0_0_1px_#D2D2CE] md:max-w-none">
          {card ? (
            // eslint-disable-next-line @next/next/no-img-element -- erzeugtes Bild im Browser
            <img src={card.src} alt="Your story card" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-[13px] text-ink-3">{failed ? "The story couldn't be made. Try again." : "Making your story…"}</span>
          )}
        </figure>
        <div className="flex min-w-0 flex-col md:p-1">
          <span className="flex justify-end">
            <button type="button" onClick={close} className="h-[38px] rounded-full border-[1.5px] border-ink px-4 text-[13px] font-semibold">Close ✕</button>
          </span>
          <span className="mt-4 flex flex-col gap-5 md:mt-7">
            <span className="label-mono text-ink-3">Story · 1080 × 1920 · in your {story.look === "day" ? "Day" : "Night"} look</span>
            <h2 id="ss-title" className="text-[34px] font-extrabold leading-[0.95] tracking-[-0.045em] md:text-[44px]">Show people your page.</h2>
            <ol className="flex flex-col gap-3.5 text-[15px] leading-[1.45] text-ink-2">
              <li className="flex gap-3"><span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-ink font-mono text-[11px] text-night-t1">1</span><span>Tap <b className="text-ink">Share story</b> and pick Instagram.</span></li>
              <li className="flex gap-3"><span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-ink font-mono text-[11px] text-night-t1">2</span><span>Add a <b className="text-ink">link sticker</b> with your page link.</span></li>
            </ol>
          </span>
          <span className="mt-8 flex flex-col gap-2.5 md:mt-auto">
            {note && <p role="status" className="text-[13px] leading-[1.4] text-ok">{note}</p>}
            <button type="button" onClick={share} disabled={!card} className="cta flex h-[58px] items-center justify-between rounded-full bg-ink px-6 text-[16px] font-semibold text-night-t1 shadow-cta disabled:bg-field-border disabled:shadow-none">
              Share story <span aria-hidden className="cta-arrow">↑</span>
            </button>
            <button type="button" onClick={async () => setNote((await copy(url)) ? "Link copied." : `Your link: ${storyUrl(story.handle)}`)} className="h-[52px] rounded-full border-[1.5px] border-ink text-[15px] font-semibold hover:bg-ink hover:text-night-t1">
              Copy page link
            </button>
            <span className="text-center text-[13px] text-ink-3">On a laptop, “Share story” saves the image instead.</span>
          </span>
        </div>
      </section>
    </div>
  );
}
