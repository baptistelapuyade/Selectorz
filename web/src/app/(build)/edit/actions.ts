"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { fromServer, toServer, type EditDraft, type EditState } from "@/lib/edit/model";
import { createClient } from "@/lib/supabase/server";

export type EditResult = { ok: true; state: EditState } | { ok: false; error: string; code?: string };

const ERRORS: Record<string, string> = {
  not_authenticated: "You're logged out. Log in again, your draft is kept.",
  too_many_sections: "Your page can have up to 8 sections.",
  invalid_links: "One of your links doesn't work. Check it in “Your links”.",
  invalid_section: "One of the links doesn't work. Check it and try again.",
  invalid_photo: "The photo didn't save. Choose it again.",
  invalid_accent: "That colour doesn't go with this look. Pick one of the colours shown.",
  bio_check: "“About you” can be up to 160 characters.",
  incomplete_profile: "Add a photo, your DJ name and your sound first. Your public page stays as it is.",
  needs_music_link: "Add a visible track or mix first. Your public page stays as it is.",
  nothing_to_discard: "There's nothing to discard yet.",
  suspended: "Your page is paused. Write to us if you think that's a mistake.",
};

function fail(message: string | undefined): EditResult {
  const code = Object.keys(ERRORS).find((k) => (message ?? "").includes(k));
  return { ok: false, error: code ? ERRORS[code] : "Something went wrong on our side. Try again in a moment.", code };
}

async function state(supabase: Awaited<ReturnType<typeof createClient>>): Promise<EditResult> {
  const { data, error } = await supabase.rpc("my_profile");
  if (error || !data) return fail(error?.message);
  return { ok: true, state: fromServer(data) };
}

// Entwurf speichern (automatisch beim Bearbeiten). Die öffentliche Seite bleibt gleich.
export async function saveDraft(d: EditDraft): Promise<EditResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_profile_draft", { p_draft: toServer(d) });
  if (error || !data) return fail(error?.message);
  return { ok: true, state: fromServer(data) };
}

// Entwurf speichern und veröffentlichen. Danach zeigt die öffentliche Seite den neuen Stand.
export async function publishChanges(d: EditDraft): Promise<EditResult> {
  const supabase = await createClient();
  const saved = await supabase.rpc("save_profile_draft", { p_draft: toServer(d) });
  if (saved.error) return fail(saved.error.message);
  const { data, error } = await supabase.rpc("publish_profile");
  if (error || !data) return fail(error?.message);
  updateTag(`profile:${(data as { handle: string }).handle}`);
  return state(supabase);
}

export async function discardChanges(): Promise<EditResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_profile_changes");
  if (error || !data) return fail(error?.message);
  return { ok: true, state: fromServer(data) };
}

// Offline nehmen: Link zeigt „No page here.“, Entwurf und Adresse bleiben.
export async function takeOffline(): Promise<EditResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_profile");
  if (error) return fail(error.message);
  const res = await state(supabase);
  if (res.ok) updateTag(`profile:${res.state.handle}`);
  return res;
}

export type PhotoResult = { ok: true; path: string; style: "dots" | "bw" } | { ok: false; error: string };

// Neues Foto: nur das fertige Raster (oder Schwarz-Weiß) in den eigenen Ordner laden.
// Live geht es erst mit „Publish changes“; das alte Bild bleibt bis dahin für die öffentliche Seite liegen.
export async function uploadPhoto(form: FormData): Promise<PhotoResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return { ok: false, error: ERRORS.not_authenticated };
  const style = form.get("style") === "bw" ? "bw" : "dots";
  const okFile = (f: FormDataEntryValue | null): f is File =>
    f instanceof File && ["image/png", "image/webp"].includes(f.type) && f.size > 0 && f.size <= 1024 * 1024;
  const files = style === "dots" ? [form.get("photo_day"), form.get("photo_night")] : [form.get("photo_bw")];
  if (!files.every(okFile)) return { ok: false, error: ERRORS.invalid_photo };
  const base = `${uid}/avatar-${randomUUID().slice(0, 8)}`;
  const paths = (files as File[]).map((f, i) => `${base}${i === 1 ? "-night" : ""}.${f.type === "image/webp" ? "webp" : "png"}`);
  for (const [i, f] of (files as File[]).entries()) {
    const up = await supabase.storage.from("avatars").upload(paths[i], f, { contentType: f.type, upsert: false });
    if (up.error) {
      await supabase.storage.from("avatars").remove(paths.slice(0, i));
      return { ok: false, error: ERRORS.invalid_photo };
    }
  }
  return { ok: true, path: paths[0], style };
}
