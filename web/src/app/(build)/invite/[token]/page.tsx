import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { JoinChain } from "@/components/chain/join-chain";
import { me } from "@/lib/chain-server";
import type { Invite } from "@/lib/chains";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "You’re invited · Selectorz", robots: { index: false } };
type Props = { params: Promise<{ token: string }> };

async function Load({ params }: Props) {
  await connection();
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("peek_invite", { p_token: token });
  const inv = (Array.isArray(data) ? data[0] : null) as Invite | null;
  if (inv?.is_participant) redirect(`/chain/${inv.chain_id}`);
  const m = await me();
  return <JoinChain token={token} invite={inv} page={m?.tracks ?? []} loggedIn={!!m} />;
}

export default function InvitePage(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Load {...props} />
    </Suspense>
  );
}
