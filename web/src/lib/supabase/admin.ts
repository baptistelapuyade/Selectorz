import { createClient } from "@supabase/supabase-js";

// Nur auf dem Server: Generalschlüssel (umgeht RLS). Ausschließlich für Aufgaben,
// die ohne ihn nicht gehen, z. B. einen Login endgültig löschen.
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("admin client on the client");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY missing");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
