"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { cleanTrackUrl, oembedEndpoint } from "@/lib/build/links";
import { mapOembed, type TrackMeta } from "@/lib/build/oembed";
import type { Payload } from "@/lib/build/draft";
import type { Provider } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type Resolved =
  | { ok: true; url: string; provider: Provider; meta: TrackMeta | null }
  | { ok: false; error: string };

// Attrappe für Tests (OEMBED_FAKE=1): Titel aus dem letzten Pfadteil, Name aus dem ersten; „fail“ scheitert.
function fakeMeta(url: string): TrackMeta | null {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts.length < 2 || url.includes("fail")) return null;
  const words = (s: string) => s.split("-").map((w) => (/\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  return { title: words(parts[parts.length - 1]), artist: words(parts[0]) };
}

// Link prüfen und Titel/Artist über die offiziellen oEmbed-Endpunkte holen (PROFILE-10, MEDIA-01).
export async function resolveLink(input: string): Promise<Resolved> {
  const link = cleanTrackUrl(String(input ?? ""));
  if (!link) return { ok: false, error: "That doesn't look like a link. Copy it from SoundCloud and paste it here." };
  const endpoint = oembedEndpoint(link.provider, link.url);
  if (!endpoint) return { ok: true, ...link, meta: null };
  if (process.env.OEMBED_FAKE === "1") return { ok: true, ...link, meta: fakeMeta(link.url) };
  try {
    // Feste Anbieter-Adresse, keine Weiterleitungen, kurze Wartezeit (TRUST-02)
    const res = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
    if (!res.ok) return { ok: true, ...link, meta: null };
    return { ok: true, ...link, meta: mapOembed(link.provider, await res.json()) };
  } catch {
    return { ok: true, ...link, meta: null };
  }
}

// Ist das Handle frei? Nur ja/nein; null, wenn die Prüfung gerade nicht geht (dann prüft „Go live“).
export async function checkHandle(handle: string): Promise<boolean | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("handle_available", { h: String(handle ?? "").toLowerCase() });
  return error || typeof data !== "boolean" ? null : data;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendly(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("seconds")) return "Too many codes in a row. Wait a minute, then try again.";
  if (m.includes("expired") || m.includes("invalid")) return "That code didn't work. It may have expired. Send a new one.";
  return "Something went wrong on our side. Try again in a moment.";
}

export type AuthResult = { ok: true } | { ok: false; error: string };

// Login im selben Fenster (AUTH-01): Code schicken. Beim ersten Mal entsteht das Konto.
export async function sendBuildCode(email: string): Promise<AuthResult> {
  const e = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, error: "That doesn't look like an email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function verifyBuildCode(email: string, code: string): Promise<AuthResult> {
  const token = String(code ?? "").replace(/\D/g, "");
  if (token.length < 6) return { ok: false, error: "Enter the whole code from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: String(email ?? "").trim().toLowerCase(), token, type: "email" });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export type PublishResult = { ok: true; handle: string } | { ok: false; error: string; code?: string };

const ERRORS: Record<string, string> = {
  handle_taken: "Someone just took that address. Pick another one, everything else is kept.",
  invalid_handle: "That page address doesn't work. Pick another one.",
  profile_exists: "You already have a page. Log in to see it.",
  incomplete_profile: "Add a photo and your sound first.",
  needs_music_link: "Add at least one track or mix.",
  invalid_section: "One of the links doesn't work. Check it and try again.",
  invalid_photo: "The photo didn't save. Choose it again.",
};

// Foto hochladen (nur das fertige Raster) und Profil in einem Schritt anlegen und veröffentlichen.
export async function publishProfile(form: FormData): Promise<PublishResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { ok: false, error: "Log in first.", code: "not_authenticated" };

  let payload: Payload;
  try {
    payload = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || !["image/png", "image/webp"].includes(photo.type) || photo.size > 1024 * 1024) {
    return { ok: false, error: ERRORS.invalid_photo, code: "invalid_photo" };
  }
  const path = `${uid}/avatar-${randomUUID().slice(0, 8)}.${photo.type === "image/webp" ? "webp" : "png"}`;
  const up = await supabase.storage.from("avatars").upload(path, photo, { contentType: photo.type, upsert: false });
  if (up.error) return { ok: false, error: ERRORS.invalid_photo, code: "invalid_photo" };

  const { error } = await supabase.rpc("create_and_publish_profile", {
    p_handle: payload.handle,
    p_display_name: payload.displayName,
    p_genres: payload.genres,
    p_plays: payload.plays,
    p_city: payload.city,
    p_look: payload.look,
    p_photo_path: path,
    p_section: payload.section,
  });
  if (error) {
    await supabase.storage.from("avatars").remove([path]); // kein verwaistes Foto
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: code ? ERRORS[code] : "Something went wrong on our side. Try again in a moment.", code };
  }
  updateTag(`profile:${payload.handle}`);
  return { ok: true, handle: payload.handle };
}
