"use server";

import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/mail";

export type ReportState = { status: "idle" | "sent" | "login" | "error"; error?: string };
const REASONS = new Set(["spam", "offensive", "impersonation", "copyright", "other"]);

// Melden (TRUST-05), optional zusätzlich blockieren (TRUST-06)
export async function submitReport(_prev: ReportState, fd: FormData): Promise<ReportState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { status: "login" };
  const me = data.claims.sub as string;

  const targetType = String(fd.get("target_type"));
  const targetId = String(fd.get("target_id"));
  const reason = String(fd.get("reason") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
  const blockAccount = String(fd.get("block_account") ?? "");
  if (!REASONS.has(reason)) return { status: "error", error: "Pick what's wrong first." };

  const { error } = await supabase.from("reports").insert({ reporter_id: me, target_type: targetType, target_id: targetId, reason, note });
  if (error) return { status: "error", error: "Couldn't send the report. Try again in a moment." };
  if (fd.get("also_block") === "on" && blockAccount && blockAccount !== me) {
    await supabase.rpc("block_account", { p_account: blockAccount });
  }
  await sendMail({
    to: "hello@selectorz.art",
    subject: `Report · ${reason} · ${targetType}`,
    text: `New report.\n\nReason: ${reason}\nTarget: ${targetType} ${targetId}\nPage: ${String(fd.get("page") ?? "")}\nNote: ${note || "(none)"}\n\nReview in Supabase: table reports.`,
  });
  return { status: "sent" };
}
