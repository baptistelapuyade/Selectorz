import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Editor } from "@/components/edit/editor";
import { fromServer } from "@/lib/edit/model";
import type { Gig } from "@/lib/gigs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit your page · Selectorz" };

async function Load() {
  await connection(); // Sitzung pro Request (Cache Components)
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login?next=/edit");
  const { data } = await supabase.rpc("my_profile");
  if (!data) redirect("/start"); // noch keine Seite: erst bauen
  const { data: gigs } = await supabase.from("gigs").select("id, date, event, city, url").eq("profile_id", data.id).order("date");
  return <Editor initial={fromServer(data)} initialGigs={(gigs as Gig[] | null) ?? []} />;
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Load />
    </Suspense>
  );
}
