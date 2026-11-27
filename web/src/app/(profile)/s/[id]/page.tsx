import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SelectionView } from "@/components/selection/selection-view";
import { firstName } from "@/lib/chains";
import { selectionTitle } from "@/lib/selection";
import { getSelection } from "@/lib/selection-server";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/chains";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ story?: string }> };

// Nicht freigegeben: dieselben neutralen Daten wie eine nie vergebene Adresse (SHARE-04, TRUST-11)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const s = await getSelection((await params).id);
  if (!s) return { title: "No page here · Selectorz", robots: { index: false } };
  const [a, b] = [s.participants.find((p) => p.role === "A")!, s.participants.find((p) => p.role === "B")!];
  const title = selectionTitle(s, a.name, b.name);
  return {
    title: `${title} · ${firstName(a.name)} × ${firstName(b.name)} · Selectorz`,
    description: `${a.name} and ${b.name} picked ${s.entries.length} tracks, back and forth.`,
    openGraph: { title: `${title}: a selection by ${firstName(a.name)} × ${firstName(b.name)}`, type: "music.playlist" },
  };
}

// Wer die Seite ansieht: eine der beiden Personen bekommt „Make a story“ (Boards DeskSelectionShare, SelectionShare)
async function myRole(id: string): Promise<Role | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chain_view", { p_chain: id });
  return ((data as { my_role?: Role } | null)?.my_role as Role | undefined) ?? null;
}

async function Load({ params, searchParams }: Props) {
  await connection();
  const id = (await params).id;
  const s = await getSelection(id);
  if (!s) notFound();
  const me = await myRole(id);
  // „Make a story“ auf Home führt mit ?story=1 hierher und öffnet die Story direkt
  return <SelectionView s={s} me={me} openStory={!!me && (await searchParams).story === "1"} />;
}

export default function SelectionPage(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Load {...props} />
    </Suspense>
  );
}
