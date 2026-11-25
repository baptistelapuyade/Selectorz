"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Home neu laden, wenn man zurückkommt: Fenster wieder im Vordergrund, oder Next zeigt die
// versteckt aufbewahrte Seite wieder an (Activity, Cache Components). Sonst sieht man alte Runden,
// obwohl die andere Person längst gespielt hat.
export function RefreshOnReturn() {
  const router = useRouter();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) router.refresh(); // Seite war versteckt und ist wieder da
    shown.current = true;
    const onFocus = () => router.refresh();
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
