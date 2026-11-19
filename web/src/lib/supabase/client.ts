import { createBrowserClient } from "@supabase/ssr";

// Supabase im Browser. Nur der öffentliche Publishable Key; Rechte regelt Row Level Security.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
