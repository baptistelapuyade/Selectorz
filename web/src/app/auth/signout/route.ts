import { SeverityNumber } from "@opentelemetry/api-logs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { posthogLogger } from "@/instrumentation";

// Abmelden nur per POST (kein Abmelden durch fremde Links), danach zur Startseite.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  posthogLogger.emit({
    body: "Authenticated session signed out",
    severityNumber: SeverityNumber.INFO,
    attributes: { auth_method: "email_otp" },
  });
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
