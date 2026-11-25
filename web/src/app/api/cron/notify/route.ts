import { processNotifications, queueReminders } from "@/lib/notify";

// Täglicher Lauf (vercel.json): fällige Erinnerungen anlegen (NOTIFY-06) und Offenes verschicken.
// Nur mit CRON_SECRET; Vercel schickt ihn als Bearer-Token mit.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const reminders = await queueReminders();
  const r = await processNotifications(200);
  return Response.json({ reminders, ...r });
}
