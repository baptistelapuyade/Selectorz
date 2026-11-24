import { pageTracks, type PageTrack } from "@/lib/chains";
import { createClient } from "@/lib/supabase/server";

// Für Kettenseiten: eingeloggt? Name und Tracks der eigenen Seite („From your page“)
export async function me(): Promise<{ id: string; name: string; tracks: PageTrack[] } | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub as string | undefined;
  if (!id) return null;
  const [{ data: prof }, { data: acc }] = await Promise.all([
    supabase.rpc("my_profile"),
    supabase.from("accounts").select("display_name").eq("id", id).maybeSingle(),
  ]);
  const draft = prof?.draft as { display_name?: string; sections?: { kind: string; visible?: boolean; content: Record<string, unknown> }[] } | undefined;
  return { id, name: draft?.display_name || acc?.display_name || "", tracks: pageTracks(draft?.sections ?? []) };
}
