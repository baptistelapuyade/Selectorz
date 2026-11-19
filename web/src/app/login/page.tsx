import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Selectorz" };

type SP = Promise<Record<string, string | string[] | undefined>>;

// Liest Sitzung und Ziel zur Laufzeit; steht deshalb hinter Suspense (Cache Components).
async function LoginGate({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);
  return <LoginForm next={next} />;
}

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between bg-night-bg p-10 text-night-t1 md:flex">
        <Link href="/" className="text-[18px] font-extrabold tracking-tight">Selectorz</Link>
        <div className="flex flex-col gap-6">
          <span className="label-mono text-night-t2">Two DJs · Six tracks · Back and forth</span>
          <p className="text-[72px] font-extrabold leading-[0.86] tracking-[-0.06em]">
            Show how
            <br />
            you play.
          </p>
        </div>
        <span className="label-mono text-night-t3">Selection over technique</span>
      </aside>
      <main className="flex flex-col px-4 py-6 md:px-20 md:py-10">
        <Link href="/" className="text-[15px] font-extrabold tracking-tight md:hidden">Selectorz</Link>
        <div className="my-auto w-full max-w-[440px] py-10">
          <Suspense fallback={<LoginForm next="/home" />}>
            <LoginGate searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="text-[14px] text-ink-3">
          New here? Your account is made with your first code.
        </p>
      </main>
    </div>
  );
}
