"use server";

import { SeverityNumber } from "@opentelemetry/api-logs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { posthogLogger } from "@/instrumentation";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: string;
  notice?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendly(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("seconds")) return "Too many codes in a row. Wait a minute, then try again.";
  if (m.includes("expired") || m.includes("invalid")) return "That code didn't work. It may have expired. Send a new one.";
  return "Something went wrong on our side. Try again in a moment.";
}

// Schritt 1: Code an die Adresse schicken. Konto wird beim ersten Mal angelegt (PRD AUTH-01).
export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { step: "email", email, error: "That doesn't look like an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { step: "email", email, error: friendly(error.message) };
  posthogLogger.emit({
    body: "Authentication code requested",
    severityNumber: SeverityNumber.INFO,
    attributes: { auth_method: "email_otp" },
  });
  return { step: "code", email };
}

// Schritt 2: Code prüfen. Bei Erfolg zurück zur ursprünglichen Seite (Einladung, Kette, Home).
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  const next = safeNext(formData.get("next"));
  if (token.length < 6) return { step: "code", email, error: "Enter the whole code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: friendly(error.message) };
  posthogLogger.emit({
    body: "Authentication code verified",
    severityNumber: SeverityNumber.INFO,
    attributes: { auth_method: "email_otp" },
  });
  redirect(next);
}

// Neuen Code schicken, ohne die Adresse neu einzugeben (PRD AUTH-05).
export async function resendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { step: "code", email, error: friendly(error.message) };
  posthogLogger.emit({
    body: "Authentication code resent",
    severityNumber: SeverityNumber.INFO,
    attributes: { auth_method: "email_otp" },
  });
  return { step: "code", email, notice: "New code sent. Only the newest one works." };
}
