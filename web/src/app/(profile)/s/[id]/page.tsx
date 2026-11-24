import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SelectionView } from "@/components/selection/selection-view";
import { firstName } from "@/lib/chains";
import { selectionTitle } from "@/lib/selection";
import { getSelection } from "@/lib/selection-server";

type Props = { params: Promise<{ id: string }> };

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

async function Load({ params }: Props) {
  await connection();
  const s = await getSelection((await params).id);
  if (!s) notFound();
  return <SelectionView s={s} />;
}

export default function SelectionPage(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Load {...props} />
    </Suspense>
  );
}
