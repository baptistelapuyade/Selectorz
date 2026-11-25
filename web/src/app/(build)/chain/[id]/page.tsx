import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChainRoom } from "@/components/chain/chain-room";
import { me } from "@/lib/chain-server";
import type { Chain } from "@/lib/chains";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Track chain · Selectorz" };
type Props = { params: Promise<{ id: string }> };

async function Load({ params }: Props) {
  await connection();
  const { id } = await params;
  const m = await me();
  if (!m) redirect(`/login?next=/chain/${encodeURIComponent(id)}`);
  const supabase = await createClient();
  const ok = /^[0-9a-f-]{36}$/i.test(id);
  const { data } = ok ? await supabase.rpc("chain_view", { p_chain: id }) : { data: null };
  if (!data)
    return (
      <main className="flex flex-1 flex-col items-start gap-4 px-4 py-16 md:px-20">
        <h1 className="text-[44px] font-extrabold leading-[0.95] tracking-[-0.05em]">No round here.</h1>
        <p className="text-[16px] text-ink-2">This round doesn’t exist or you’re not part of it.</p>
        <Link href="/home" className="link-hover font-semibold underline underline-offset-4">Go to my rounds</Link>
      </main>
    );
  return <ChainRoom initial={data as Chain} page={m.tracks} handle={m.handle} notify={m.notify} />;
}

export default function ChainPage(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Load {...props} />
    </Suspense>
  );
}
