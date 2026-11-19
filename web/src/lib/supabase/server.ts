import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase in Server Components, Server Actions und Route Handlers.
// Pro Request neu erzeugen, nie global teilen.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // In Server Components dürfen keine Cookies gesetzt werden; der Proxy erneuert die Sitzung.
          }
        },
      },
    },
  );
}
