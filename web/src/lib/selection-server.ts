import { createClient } from "@supabase/supabase-js";
import type { Selection } from "@/lib/selection";

// Öffentliche Selection ohne Sitzung lesen; liefert nur mit beiden Freigaben etwas (PUBLISH-01/02)
export async function getSelection(id: string): Promise<Selection | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase.rpc("selection_view", { p_chain: id });
  return (data as Selection | null) ?? null;
}
