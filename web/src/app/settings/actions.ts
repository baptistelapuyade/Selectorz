"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/settings");
  return { supabase, id: data.claims.sub as string, email: (data.claims.email as string) ?? "" };
}

export async function setNotifyEmail(fd: FormData) {
  const { supabase, id } = await me();
  await supabase.from("accounts").update({ notify_email: fd.get("notify_email") === "on" }).eq("id", id);
  revalidatePath("/settings");
}

export async function unblock(fd: FormData) {
  const { supabase, id } = await me();
  await supabase.from("blocks").delete().eq("blocker_id", id).eq("blocked_id", String(fd.get("account_id")));
  revalidatePath("/settings");
}

export type DeleteState = { error?: string };

// Konto löschen (TRUST-09, PRD 11.4): erst gemeinsame Inhalte sichern, dann Login löschen.
export async function deleteAccount(_prev: DeleteState, fd: FormData): Promise<DeleteState> {
  const { supabase, id, email } = await me();
  const typed = String(fd.get("confirm") ?? "").trim().toLowerCase();
  if (!email || typed !== email.toLowerCase()) return { error: "Type your email exactly as shown to confirm." };

  const { error } = await supabase.rpc("prepare_account_deletion");
  if (error) return { error: "Couldn't delete right now. Nothing was changed. Try again in a moment." };

  const { error: delError } = await createAdminClient().auth.admin.deleteUser(id);
  if (delError) return { error: "Couldn't finish deleting. Write to hello@selectorz.art and we'll do it by hand." };

  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
