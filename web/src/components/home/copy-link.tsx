"use client";

import { useState } from "react";

// Link der eigenen Seite kopieren (Home). Ohne Zwischenablage: Link markierbar anzeigen.
export function CopyLink({ url, disabled }: { url: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
      className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-ink text-[14px] font-semibold hover:bg-ink hover:text-night-t1 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
    >
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy link"}</span>
    </button>
  );
}
