// Versand über Resend (REST, ohne zusätzliche Abhängigkeit). Fehler blockieren nie
// die eigentliche Aktion; ohne Key wird nichts verschickt (lokal, Vorschau).
// In Browser-Tests (MAIL_TRANSPORT=mailpit) landen Mails in Mailpit statt bei Resend.
type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string; idempotencyKey?: string; headers?: Record<string, string> };

const FROM = { name: "Selectorz", email: "notify@mail.selectorz.art" };

async function viaMailpit(mail: Mail): Promise<boolean> {
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  try {
    const res = await fetch(`${base}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: FROM.email, Name: FROM.name },
        To: [{ Email: mail.to }],
        Subject: mail.subject,
        Text: mail.text,
        ...(mail.html ? { HTML: mail.html } : {}),
        ...(mail.headers ? { Headers: mail.headers } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendMail(mail: Mail): Promise<boolean> {
  if (process.env.MAIL_TRANSPORT === "mailpit") return viaMailpit(mail);
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: `${FROM.name} <${FROM.email}>`,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
        ...(mail.replyTo ? { reply_to: [mail.replyTo] } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
