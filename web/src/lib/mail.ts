// Versand über Resend (REST, ohne zusätzliche Abhängigkeit). Fehler blockieren nie
// die eigentliche Aktion; ohne Key wird nichts verschickt (lokal, Tests, Vorschau).
type Mail = { to: string; subject: string; text: string; replyTo?: string; idempotencyKey?: string };

export async function sendMail(mail: Mail): Promise<boolean> {
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
        from: "Selectorz <notify@mail.selectorz.art>",
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: [mail.replyTo] } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
