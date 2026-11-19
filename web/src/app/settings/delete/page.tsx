import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DeleteForm } from "./delete-form";

export const metadata: Metadata = { title: "Delete account · Selectorz" };

const STEPS = [
  "Your page goes offline right away. The link shows “No page here.”",
  "Your approvals are taken back. Shared selections become private again.",
  "In open rounds, the other DJ sees that you left. Their tracks stay.",
  "Your email and login are deleted for good.",
];

async function Confirm() {
  await connection(); // Sitzung prüfen heißt: Uhrzeit pro Request (Cache Components)
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/settings/delete");
  return <DeleteForm email={data.claims.email as string} />;
}

export default function DeletePage() {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-6 md:px-20 md:py-10">
      <Link href="/settings" className="text-[15px] font-semibold underline underline-offset-4">← Settings</Link>
      <div className="flex max-w-[560px] flex-col gap-6">
        <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[64px]">Delete your account?</h1>
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4 border-t border-line py-3 text-[15px] leading-[1.45]">
              <span className="font-mono text-[12px] text-ink-3">0{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <Suspense fallback={null}>
          <Confirm />
        </Suspense>
        <Link href="/settings" className="self-center text-[15px] font-semibold underline underline-offset-4">Keep my account</Link>
      </div>
    </main>
  );
}
