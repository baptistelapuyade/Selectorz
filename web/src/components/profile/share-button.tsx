"use client";

import { useState } from "react";
import { track } from "@/components/analytics";
import { copyText } from "@/lib/copy";

export function ShareButton({ name, color }: { name: string; color: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href.split(/[?#]/)[0];
        try {
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
            await navigator.share({ title: `${name} on Selectorz`, url });
            track("share_opened", { surface: "profile" });
            return;
          }
        } catch {
          return; // abgebrochen
        }
        if (!(await copyText(url))) return;
        setCopied(true);
        track("profile_link_copied");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="tint flex h-10 flex-none items-center gap-2 rounded-full border-[1.5px] px-4 text-[14px] font-semibold md:h-11 md:px-5"
      style={{ borderColor: color, color }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v13" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></svg>
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
