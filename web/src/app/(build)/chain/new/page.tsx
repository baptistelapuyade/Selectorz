import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StartChain } from "@/components/chain/start-chain";
import { me } from "@/lib/chain-server";

export const metadata: Metadata = { title: "Start a chain · Selectorz" };

async function Load() {
  await connection();
  const m = await me();
  if (!m) redirect("/login?next=/chain/new");
  return <StartChain name={m.name || "You"} page={m.tracks} />;
}

export default function NewChainPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Load />
    </Suspense>
  );
}
