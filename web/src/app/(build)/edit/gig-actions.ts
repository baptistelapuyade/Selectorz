"use server";

import { updateTag } from "next/cache";
import { cleanGigUrl, type Gig } from "@/lib/gigs";
import { createClient } from "@/lib/supabase/server";

// Gigs gehen sofort live: kein Entwurf, kein „Publish changes“ (Entscheidung PO 23.11.2026).
export type GigInput = { id?: string; date: string; event: string; city: string; url: string };
export type GigResult = { ok: true; gig: Gig; gigs: Gig[] } | { ok: false; error: string; field?: "date" | "event" | "city" | "url" };
export type GigsResult = { ok: true; gigs: Gig[] } | { ok: false; error: string };

const URL_ERROR = "That link doesn't open. Paste the full address from your browser, it starts with https://. Or leave it empty.";
const COLS = "id, date, event, city, url";

async function mine() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { supabase, profile: null };
  const { data } = await supabase.from("profiles").select("id, handle").eq("account_id", uid).maybeSingle();
  return { supabase, profile: data as { id: string; handle: string } | null };
}

async function all(supabase: Awaited<ReturnType<typeof createClient>>, pid: string): Promise<Gig[]> {
  const { data } = await supabase.from("gigs").select(COLS).eq("profile_id", pid).order("date");
  return (data as Gig[] | null) ?? [];
}

export async function listGigs(): Promise<GigsResult> {
  const { supabase, profile } = await mine();
  if (!profile) return { ok: false, error: "You're logged out. Log in again." };
  return { ok: true, gigs: await all(supabase, profile.id) };
}

export async function saveGig(input: GigInput): Promise<GigResult> {
  const { supabase, profile } = await mine();
  if (!profile) return { ok: false, error: "You're logged out. Log in again." };
  const event = String(input.event ?? "").trim();
  const city = String(input.city ?? "").trim();
  const date = String(input.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a date.", field: "date" };
  if (!event) return { ok: false, error: "Add the event or club.", field: "event" };
  if (!city) return { ok: false, error: "Add the city.", field: "city" };
  const link = cleanGigUrl(String(input.url ?? ""));
  if (!link.ok) return { ok: false, error: URL_ERROR, field: "url" };

  const row = { date, event: event.slice(0, 80), city: city.slice(0, 60), url: link.url };
  const q = input.id
    ? supabase.from("gigs").update(row).eq("id", input.id).eq("profile_id", profile.id).select(COLS).single()
    : supabase.from("gigs").insert({ ...row, profile_id: profile.id }).select(COLS).single();
  const { data, error } = await q;
  if (error || !data) {
    const m = error?.message ?? "";
    if (m.includes("invalid_gig_date")) return { ok: false, error: "Pick a date from today on.", field: "date" };
    if (m.includes("url_check")) return { ok: false, error: URL_ERROR, field: "url" };
    if (m.includes("too_many_gigs")) return { ok: false, error: "That's 50 gigs. Remove a few old ones first." };
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
  updateTag(`profile:${profile.handle}`);
  return { ok: true, gig: data as Gig, gigs: await all(supabase, profile.id) };
}

export async function deleteGig(id: string): Promise<GigsResult> {
  const { supabase, profile } = await mine();
  if (!profile) return { ok: false, error: "You're logged out. Log in again." };
  const { error } = await supabase.from("gigs").delete().eq("id", id).eq("profile_id", profile.id);
  if (error) return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  updateTag(`profile:${profile.handle}`);
  return { ok: true, gigs: await all(supabase, profile.id) };
}
