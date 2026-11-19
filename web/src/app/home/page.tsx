import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home · Selectorz" };

// Platzhalter für die eigene Übersicht (DeskHome3). Zeigt vorerst nur, dass der Login klappt.
async function Who() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/home");
  const email = data.claims.email as string | undefined;
  return <>Logged in as {email}. Your page and chains come next.</>;
}

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-10 px-4 py-6 md:px-20 md:py-10">
      <header className="flex items-center justify-between">
        <span className="text-[18px] font-extrabold tracking-tight">Selectorz</span>
        <form action="/auth/signout" method="post">
          <button className="h-10 rounded-full border-[1.5px] border-ink px-5 text-[14px] font-semibold">Log out</button>
        </form>
      </header>
      <div className="flex flex-col gap-3">
        <span className="label-mono text-ink-3">You&apos;re in</span>
        <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[88px]">Your rounds.</h1>
        <p className="text-[15px] text-ink-2 md:text-[17px]"><Suspense fallback="…">
            <Who />
          </Suspense></p>
      </div>
    </main>
  );
}
