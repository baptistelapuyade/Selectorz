"use server";

import { randomUUID } from "node:crypto";
import type { Chain } from "@/lib/chains";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { processNotifications } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";

export type PickedTrack = { url: string; title: string; artist?: string };
type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string; code?: string };

const ERRORS: Record<string, string> = {
  not_authenticated: "You're logged out. Log in again, your pick is kept.",
  suspended: "Your account is paused. Write to us if you think that's a mistake.",
  not_allowed: "That's not possible in this round.",
  not_your_turn: "It's not your turn right now. The page shows the current state.",
  stale: "Someone was quicker: the round moved on. Here is the current state.",
  chain_not_active: "This round doesn't take new tracks anymore.",
  duplicate_track: "That track is already in this round. Pick another one.",
  invite_not_found: "This invite doesn't exist.",
  invite_revoked: "This invite was replaced or has expired. Ask for a new link.",
  chain_taken: "Someone else answered first. This round already has two DJs.",
  own_invite: "That's your own invite. Send it to the DJ you want to play with.",
  blocked: "You can't join this round.",
  chain_not_completed: "This round isn't complete yet.",
};

function fail(message: string | undefined): Fail {
  const code = Object.keys(ERRORS).find((k) => (message ?? "").includes(k));
  return { ok: false, error: code ? ERRORS[code] : "Something went wrong on our side. Try again in a moment.", code };
}

const clean = (t: PickedTrack) => {
  const url = String(t.url ?? "").trim();
  const title = String(t.title ?? "").trim().slice(0, 200);
  return { url, title, artist: String(t.artist ?? "").trim().slice(0, 200), ok: /^https:\/\/\S+$/.test(url) && url.length <= 500 && title.length > 0 };
};

// Kette starten: Track 1 und Einladungslink in einem Schritt (CHAIN-01)
export async function startChain(t: PickedTrack, comment: string, title: string): Promise<Ok<{ chain: string; token: string }> | Fail> {
  const c = clean(t);
  if (!c.ok) return { ok: false, error: "Add a track with a title first." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_chain", {
    p_title: String(title ?? "").trim().slice(0, 60),
    p_url: c.url,
    p_track_title: c.title,
    p_artist: c.artist,
    p_comment: String(comment ?? "").trim().slice(0, 140),
    p_request_id: randomUUID(),
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return fail(error?.message);
  return { ok: true, chain: row.chain_id, token: row.invite_token };
}

export async function getChain(id: string): Promise<Ok<{ chain: Chain }> | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("chain_view", { p_chain: id });
  if (error || !data) return fail(error?.message ?? "not_allowed");
  return { ok: true, chain: data as Chain };
}

// Nächster Track. request ist pro Klick fest: doppelte Anfrage = ein Track (CHAIN-07)
export async function addTrack(id: string, position: number, t: PickedTrack, comment: string, request: string): Promise<Ok<{ chain: Chain }> | Fail> {
  const c = clean(t);
  if (!c.ok) return { ok: false, error: "Add a track with a title first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_track", {
    p_chain: id,
    p_position: position,
    p_url: c.url,
    p_track_title: c.title,
    p_artist: c.artist,
    p_comment: String(comment ?? "").trim().slice(0, 140),
    p_request_id: request,
  });
  if (error) {
    const f = fail(error.message);
    const now = await getChain(id);
    return now.ok ? { ...f, chain: now.chain } as Fail : f;
  }
  after(() => processNotifications()); // Mail an die andere Person nach der Antwort (NOTIFY-08)
  return getChain(id);
}

export async function renewInvite(id: string): Promise<Ok<{ token: string }> | Fail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_invite", { p_chain: id });
  if (error || !data) return fail(error?.message);
  return { ok: true, token: data as string };
}

export async function revokeInvite(id: string): Promise<Ok<object> | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_chain: id });
  return error ? fail(error.message) : { ok: true };
}

export async function endChain(id: string): Promise<Ok<{ chain: Chain }> | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_chain", { p_chain: id });
  if (error) return fail(error.message);
  return getChain(id);
}

// Beitreten und Track 2 setzen (CHAIN-02..04). Ohne Seite und ohne Namen: Name einmal angeben.
export async function joinChain(token: string, t: PickedTrack, comment: string, request: string, name?: string): Promise<Ok<{ chain: string }> | Fail> {
  const c = clean(t);
  if (!c.ok) return { ok: false, error: "Add a track with a title first." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return fail("not_authenticated");
  const n = String(name ?? "").trim().slice(0, 60);
  if (n) await supabase.from("accounts").update({ display_name: n }).eq("id", uid);
  const { data, error } = await supabase.rpc("join_chain", {
    p_token: token,
    p_url: c.url,
    p_track_title: c.title,
    p_artist: c.artist,
    p_comment: String(comment ?? "").trim().slice(0, 140),
    p_request_id: request,
  });
  if (error || !data) return fail(error?.message);
  after(() => processNotifications());
  return { ok: true, chain: data as string };
}

// Braucht die eingeloggte Person beim Beitritt noch einen Namen? (keine Seite, kein Kontoname)
export async function needsName(): Promise<boolean> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) return true;
  const [{ data: acc }, { data: prof }] = await Promise.all([
    supabase.from("accounts").select("display_name").eq("id", uid).maybeSingle(),
    supabase.from("profiles").select("id").eq("account_id", uid).eq("status", "published").maybeSingle(),
  ]);
  return !prof && !String(acc?.display_name ?? "").trim();
}

// Freigabe zum Veröffentlichen geben oder zurücknehmen (PUBLISH-01..03)
export async function setApproval(id: string, yes: boolean): Promise<Ok<{ chain: Chain }> | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_chain_approval", { p_chain: id, p_approve: yes });
  if (error) return fail(error.message);
  const r = await getChain(id);
  // Profile beider zeigen freigegebene Selections: Cache der Profile erneuern (auch beim Zurücknehmen)
  if (r.ok) for (const p of r.chain.participants) if (p.handle) updateTag(`profile:${p.handle}`);
  return r;
}

// Name der Runde (DeskChainComplete3 „Name it“): beide Beteiligten dürfen umbenennen
export async function renameChain(id: string, title: string): Promise<Ok<{ chain: Chain }> | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_chain", { p_chain: id, p_title: String(title ?? "").slice(0, 200) });
  if (error) return fail(error.message);
  const r = await getChain(id);
  if (r.ok && r.chain.public) for (const p of r.chain.participants) if (p.handle) updateTag(`profile:${p.handle}`);
  return r;
}

// „Email me“ in der Übergabe (DeskChainHandoff3): gleiche Einstellung wie in Settings
export async function setNotify(on: boolean): Promise<Ok<{ on: boolean }> | Fail> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) return fail("not_authenticated");
  const { error } = await supabase.from("accounts").update({ notify_email: !!on }).eq("id", id);
  if (error) return fail(error.message);
  return { ok: true, on: !!on };
}
