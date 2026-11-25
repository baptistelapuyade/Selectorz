// Nur auf dem Server verwenden (Generalschlüssel).
import { chainMail, type MailEvent } from "@/lib/chain-mail";
import { sendMail } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.selectorz.art";

// Offene Ketten-Ereignisse verschicken (NOTIFY-01/03/08). Läuft nach jedem Zug (after) und täglich per Cron.
// Fehler blockieren nie den Zug: das Ereignis bleibt offen und wird später erneut versucht (höchstens dreimal).
export async function processNotifications(limit = 20): Promise<{ sent: number; failed: number }> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { sent: 0, failed: 0 }; // ohne Generalschlüssel (lokal, Vorschau ohne Secret) nichts tun
  }
  const { data, error } = await admin.rpc("claim_notifications", { p_limit: limit });
  if (error || !Array.isArray(data)) return { sent: 0, failed: 0 };
  let sent = 0, failed = 0;
  for (const e of data as MailEvent[]) {
    let ok = false;
    if (e.to) {
      const m = chainMail(e, SITE());
      ok = await sendMail({ to: e.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers, idempotencyKey: `chain-mail-${e.id}` });
    }
    await admin.rpc("finish_notification", { p_id: e.id, p_ok: ok });
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

export async function queueReminders(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("queue_reminders");
  return (data as number | null) ?? 0;
}
