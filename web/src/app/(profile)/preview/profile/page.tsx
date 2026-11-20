import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ProfileView } from "@/components/profile/profile-view";
import { SAMPLE_PROFILE } from "@/lib/sample-profile";

// Vorschau mit Beispieldaten für Design-Abnahme (lokal und in Vercel-Vorschauen, nie live).
async function Preview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  if (process.env.VERCEL_ENV === "production") notFound();
  const sp = await searchParams;
  const p = {
    ...SAMPLE_PROFILE,
    look: sp.look === "night" ? ("night" as const) : ("day" as const),
    accent: sp.look === "night" ? "#F0532A" : "#8C93FF",
    ...(sp.name ? { display_name: sp.name } : {}),
    ...(sp.minimal ? { sections: SAMPLE_PROFILE.sections.slice(0, 1), links: [], bio: "", city: "", plays: [] } : {}),
  };
  return <ProfileView p={p} profileId="00000000-0000-0000-0000-000000000000" accountId="00000000-0000-0000-0000-000000000000" />;
}

export default function PreviewPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={null}>
      <Preview {...props} />
    </Suspense>
  );
}
