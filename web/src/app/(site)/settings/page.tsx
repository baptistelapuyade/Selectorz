import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setNotifyEmail, unblock } from "./actions";

export const metadata: Metadata = { title: "Settings · Selectorz" };

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink pt-4">
      <span className="label-mono text-ink-3">{label}</span>
      {children}
    </section>
  );
}

async function SettingsContent() {
  await connection(); // Sitzung prüfen heißt: Uhrzeit pro Request (Cache Components)
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/settings");
  const id = data.claims.sub as string;
  const email = data.claims.email as string;
  const [{ data: account }, { data: blocks }] = await Promise.all([
    supabase.from("accounts").select("notify_email").eq("id", id).single(),
    supabase.rpc("my_blocks"),
  ]);

  return (
    <>
      <Section label="Notifications">
        <form action={setNotifyEmail} className="flex flex-col gap-3">
          <label className="flex items-start gap-3 text-[16px]">
            <input type="checkbox" name="notify_email" defaultChecked={account?.notify_email ?? true} className="mt-1 h-5 w-5 accent-ink" />
            <span className="flex flex-col">
              <span className="font-semibold">Email when it&apos;s my turn</span>
              <span className="text-[14px] text-ink-3">One mail per move. Includes the link.</span>
            </span>
          </label>
          <button className="h-11 self-start rounded-full border-[1.5px] border-ink px-5 text-[14px] font-semibold hover:bg-ink hover:text-night-t1">Save</button>
        </form>
      </Section>

      <Section label="Account">
        <p className="text-[16px]">
          <span className="text-ink-3">Email </span>
          <span className="font-semibold">{email}</span>
        </p>
      </Section>

      <Section label="Blocked">
        {blocks && blocks.length > 0 ? (
          <ul className="flex flex-col">
            {blocks.map((b: { account_id: string; display_name: string }) => (
              <li key={b.account_id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <span className="flex flex-col">
                  <span className="font-semibold">{b.display_name}</span>
                  <span className="text-[13px] text-ink-3">Can&apos;t invite you or see your rounds.</span>
                </span>
                <form action={unblock} className="ml-auto">
                  <input type="hidden" name="account_id" value={b.account_id} />
                  <button className="text-[14px] font-semibold underline underline-offset-4 link-hover">Unblock</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-3">Nobody. You can block someone from their page or a round.</p>
        )}
      </Section>

      <Section label="Delete">
        <p className="text-[15px] leading-[1.45] text-ink-2">
          Removes your page and takes back your approvals. You&apos;ll see what happens before anything is deleted.
        </p>
        <Link href="/settings/delete" className="self-start text-[15px] font-semibold text-error-text underline underline-offset-4 link-hover">
          Delete my account
        </Link>
      </Section>
    </>
  );
}

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-6 md:px-20 md:py-10">
      <header className="flex items-center justify-between">
        <Link href="/home" className="text-[18px] font-extrabold tracking-tight">Selectorz</Link>
        <form action="/auth/signout" method="post">
          <button className="h-10 rounded-full border-[1.5px] border-ink px-5 text-[14px] font-semibold hover:bg-ink hover:text-night-t1">Log out</button>
        </form>
      </header>
      <h1 className="text-[44px] font-extrabold leading-[0.9] tracking-[-0.05em] md:text-[72px]">Settings</h1>
      <div className="flex max-w-[640px] flex-col gap-8">
        <Suspense fallback={<p className="text-ink-3">…</p>}>
          <SettingsContent />
        </Suspense>
      </div>
    </main>
  );
}
