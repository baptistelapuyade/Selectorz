import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { PublicProfile } from "@/lib/profile";

export type PublicProfileRow = { id: string; account_id: string; published: PublicProfile };

// Öffentliche Daten ohne Sitzung lesen (RLS zeigt nur veröffentlichte Profile).
// Zwischengespeichert; Veröffentlichen/Zurückziehen leert den Eintrag per Tag.
export async function getPublicProfile(handle: string): Promise<PublicProfileRow | null> {
  "use cache";
  cacheTag(`profile:${handle}`);
  cacheLife("minutes");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase
    .from("profiles")
    .select("id, account_id, published")
    .eq("handle", handle)
    .eq("status", "published")
    .maybeSingle();
  return (data as PublicProfileRow | null) ?? null;
}
