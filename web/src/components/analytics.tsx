"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// PostHog EU, ohne Cookies und ohne Speicher im Browser (cookieless_mode: always),
// keine Session-Aufnahmen, kein Autocapture. Nur Produktion (oder ausdrücklich gesetzter Key).
const KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "phc_w6qBf2Tdqzz2fVM9fahpkjzb54ZYQufS95mdw4Yz9je4" : undefined);
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let started = false;

// Adressen ohne Query-String und Hash: keine Tokens, Codes oder Mails in Events (PRD 19.2)
function clean(url: unknown) {
  if (typeof url !== "string") return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

export function Analytics() {
  useEffect(() => {
    if (!KEY || started) return;
    started = true;
    posthog.init(KEY, {
      api_host: HOST,
      cookieless_mode: "always",
      capture_pageview: "history_change",
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      // Headless-Browser der Tests würden sonst als Bot verworfen; nur mit Test-Key
      opt_out_useragent_filter: KEY === "phc_e2e_test",
      disable_compression: true, // kleine Mengen; Klartext macht die Datenschutz-Tests prüfbar
      before_send: (event) => {
        if (!event) return event;
        const p = event.properties ?? {};
        for (const k of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer", "$prev_pageview_pathname"]) {
          if (k in p) p[k] = clean(p[k]);
        }
        return event;
      },
    });
  }, []);
  return null;
}

// Eigene Ereignisse (PRD 19.2). Nie Mails, Tokens oder Freitexte mitgeben.
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (started) posthog.capture(event, props);
}
