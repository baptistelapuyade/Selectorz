// Holt den Login-Code aus Mailpit (fängt bei lokalem Supabase alle Mails ab).
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; To: { Address: string }[]; Created: string };

export async function latestCode(email: string, after: number, timeoutMs = 15_000): Promise<string> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (res.ok) {
      const { messages } = (await res.json()) as { messages: Summary[] };
      const fresh = messages.filter((m) => new Date(m.Created).getTime() >= after - 1000);
      if (fresh.length) {
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json();
        const match = String(msg.HTML ?? msg.Text ?? "").match(/>\s*(\d{6})\s*</) ?? String(msg.Text ?? "").match(/\b(\d{6})\b/);
        if (match) return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No login code for ${email} within ${timeoutMs} ms`);
}

export type MailSummary = { ID: string; Subject: string; Created: string };

// Alle Mails an eine Adresse (neueste zuerst)
export async function mailsTo(email: string): Promise<MailSummary[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  if (!res.ok) return [];
  return ((await res.json()) as { messages: MailSummary[] }).messages;
}

// Wartet auf eine Mail mit passendem Betreff und gibt Text und HTML zurück
export async function waitForMail(email: string, subject: RegExp, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const m = (await mailsTo(email)).find((x) => subject.test(x.Subject));
    if (m) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      return { subject: m.Subject, text: String(full.Text ?? ""), html: String(full.HTML ?? ""), id: m.ID };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No mail "${subject}" for ${email} within ${timeoutMs} ms`);
}
