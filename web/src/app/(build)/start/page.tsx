import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Builder } from "@/components/build/builder";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Make your DJ page · Selectorz",
  description: "Paste one link and get the first version of your DJ page.",
};

// Wer schon eine Seite hat, bearbeitet sie, statt eine zweite zu bauen (eine Seite pro Login)
async function HasPage() {
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;
  const { data } = await supabase.rpc("my_profile");
  if (data) redirect("/edit");
  return null;
}

export default function StartPage() {
  return (
    <>
      <Suspense fallback={null}>
        <HasPage />
      </Suspense>
      <Builder />
    </>
  );
}
