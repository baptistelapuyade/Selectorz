"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/mail";

export type FeedbackState = { status: "idle" | "sent" | "error"; error?: string };

const KINDS = new Set(["bug", "confusing", "idea", "love"]);

export async function submitFeedback(_prev: FeedbackState, fd: FormData): Promise<FeedbackState> {
  // Köderfeld: Menschen sehen es nicht, Bots füllen es aus. Dann still „gesendet“.
  if (String(fd.get("website") ?? "").trim() !== "") return { status: "sent" };

  const message = String(fd.get("message") ?? "").trim().slice(0, 3000);
  const kind = String(fd.get("kind") ?? "idea");
  const page = String(fd.get("page") ?? "").split("?")[0].slice(0, 300);
  const contactOk = fd.get("contact_ok") === "on";
  if (!message) return { status: "error", error: "Write a few words first." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = (h.get("user-agent") ?? "").slice(0, 400);
  // Kein Klartext-IP: Hash nur für das Ratenlimit, wechselt täglich.
  const day = new Date().toISOString().slice(0, 10);
  const rateKey = createHash("sha256").update(`${day}|${ip}|${ua}`).digest("hex").slice(0, 32);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: id, error } = await supabase.rpc("submit_feedback", {
    p_page: page,
    p_kind: KINDS.has(kind) ? kind : "other",
    p_message: message,
    p_contact_ok: contactOk,
    p_user_agent: ua,
    p_rate_key: rateKey,
  });
  if (error) {
    return error.message.includes("rate_limited")
      ? { status: "error", error: "That's a lot of notes in a row. Try again in a few minutes." }
      : { status: "error", error: "Couldn't send it. Try again in a moment." };
  }

  const email = claims?.claims?.email as string | undefined;
  await sendMail({
    to: "hello@selectorz.art",
    subject: `Feedback · ${kind} · ${page || "/"}`,
    text: `${message}\n\n---\nKind: ${kind}\nPage: ${page}\nAccount: ${email ?? "not logged in"}\nContact OK: ${contactOk ? "yes" : "no"}\nBrowser: ${ua}\nID: ${id}`,
    replyTo: contactOk && email ? email : undefined,
    idempotencyKey: `feedback-${id}`,
  });
  return { status: "sent" };
}
