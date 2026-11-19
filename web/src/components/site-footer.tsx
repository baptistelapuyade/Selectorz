"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";

const identifiedUserStorageKey = "selectorz.posthog-identified-user-id";
const isPostHogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

// Rechtliche Links auf jeder Seite, höchstens ein Klick entfernt (§ 5 DDG).
export function SiteFooter() {
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isPostHogConfigured) return;

    const supabase = createClient();
    const identifyUser = (user: { id: string; email?: string }) => {
      if (identifiedUserId.current === user.id) return;

      const previousUserId = identifiedUserId.current ?? localStorage.getItem(identifiedUserStorageKey);
      if (previousUserId && previousUserId !== user.id) posthog.reset();
      posthog.identify(user.id, user.email ? { email: user.email } : {});
      localStorage.setItem(identifiedUserStorageKey, user.id);
      identifiedUserId.current = user.id;
    };
    const resetUser = () => {
      if (!localStorage.getItem(identifiedUserStorageKey)) return;

      posthog.reset();
      localStorage.removeItem(identifiedUserStorageKey);
      identifiedUserId.current = null;
    };

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) identifyUser(user);
      else resetUser();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        identifyUser(session.user);
        if (event === "SIGNED_IN") posthog.capture("user_logged_in", { auth_method: "email_otp" });
      } else {
        resetUser();
      }
    });
    const resetOnSignOut = (event: SubmitEvent) => {
      if (event.target instanceof HTMLFormElement && new URL(event.target.action).pathname === "/auth/signout") {
        posthog.capture("user_logged_out");
        resetUser();
      }
    };

    document.addEventListener("submit", resetOnSignOut);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener("submit", resetOnSignOut);
    };
  }, []);

  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-4 text-[13px] text-ink-3 md:px-20">
      <span className="font-extrabold text-ink">Selectorz</span>
      <span className="label-mono">Alpha</span>
      <nav className="ml-auto flex gap-5">
        <Link href="/imprint" className="hover:text-ink hover:underline">Imprint</Link>
      </nav>
    </footer>
  );
}
