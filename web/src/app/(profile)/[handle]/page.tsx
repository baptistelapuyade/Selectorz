import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { isHandle } from "@/lib/handles";
import { getPublicProfile } from "@/lib/public-profile";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeURIComponent((await params).handle).toLowerCase();
  const row = isHandle(handle) ? await getPublicProfile(handle) : null;
  if (!row) return { title: "No page here · Selectorz" };
  const p = row.published;
  return {
    title: `${p.display_name} · Selectorz`,
    description: [p.genres.join(", "), p.city].filter(Boolean).join(" · ") || "A DJ page on Selectorz",
    openGraph: { title: `${p.display_name} on Selectorz`, type: "profile" },
  };
}

async function Profile({ params }: Props) {
  const handle = decodeURIComponent((await params).handle).toLowerCase();
  if (!isHandle(handle)) notFound();
  const row = await getPublicProfile(handle);
  if (!row) notFound(); // nie vergeben und zurückgezogen sehen gleich aus (PROFILE-07)
  return <ProfileView p={row.published} profileId={row.id} accountId={row.account_id} gigs={row.gigs} selections={row.selections} />;
}

export default function ProfilePage(props: Props) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Profile {...props} />
    </Suspense>
  );
}
