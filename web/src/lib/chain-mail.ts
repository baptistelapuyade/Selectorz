// Ketten-Mails (Boards MailTurn, MailReminder, MailComplete): Text und schlichtes, mailtaugliches HTML,
// genau ein Button. Keine Tokens, keine fremden E-Mail-Adressen im Inhalt.
import { firstName } from "@/lib/chains";

export type MailEvent = {
  id: string;
  kind: "your_turn" | "reminder" | "completed";
  to: string;
  chain: { id: string; title: string; target: number; count: number };
  other: { name: string } | null;
  last: { title: string; artist: string; comment: string; mine: boolean; at: string } | null;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const daysAgo = (iso: string, now: Date) => {
  const d = Math.max(1, Math.round((now.getTime() - new Date(iso).getTime()) / 864e5));
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export function chainMail(e: MailEvent, site: string, now = new Date()) {
  const other = e.other?.name ?? "Your partner";
  const o = firstName(other);
  const title = e.chain.title.trim() || `${o} and you`;
  const next = Math.min(e.chain.count + 1, e.chain.target);
  const url = `${site}/chain/${e.chain.id}`;
  const settings = `${site}/settings`;
  const last = e.last;

  let subject: string, preview: string, eyebrow: string, head: [string, string], lastLabel: string, lastMeta: string, body: string, cta: string, why: string;
  if (e.kind === "completed") {
    subject = `${title} is complete`;
    preview = `Six tracks with ${o}. Show it off or keep it between you.`;
    eyebrow = "TRACK CHAIN · COMPLETE";
    head = ["Six tracks.", "Done together."];
    lastLabel = "THE LAST ONE";
    lastMeta = last ? `${last.artist ? `${last.artist} · ` : ""}picked by ${last.mine ? "you" : o}` : "";
    body = "Want it on both your profiles? You both need to say yes. Then make a story to share it.";
    cta = "See your selection";
    why = `You get this because you finished a track chain with ${other}.`;
  } else if (e.kind === "reminder") {
    subject = `${o} is still waiting for your track`;
    preview = `${title} is at ${e.chain.count} of ${e.chain.target}. No rush, just a nudge.`;
    eyebrow = "TRACK CHAIN · STILL YOUR TURN";
    head = ["Still thinking", `about track ${next}?`];
    lastLabel = "LAST TRACK";
    lastMeta = last ? `${last.artist ? `${last.artist} · ` : ""}picked by ${o} ${daysAgo(last.at, now)}` : "";
    body = "No rush. This is the only reminder we send for this turn.";
    cta = `Pick track ${next}`;
    why = "One reminder per turn, never more.";
  } else {
    subject = `Your turn: ${o} answered`;
    preview = last ? `${last.title}${last.artist ? ` by ${last.artist}` : ""}. Pick track ${next} of ${e.chain.target}.` : `Pick track ${next}.`;
    eyebrow = "TRACK CHAIN · YOUR TURN";
    head = [`${o} answered.`, `Track ${next} is yours.`];
    lastLabel = `${o.toUpperCase()} ANSWERED`;
    lastMeta = last ? [last.artist, last.comment && `“${last.comment}”`].filter(Boolean).join(" · ") : "";
    body = "Have a listen, then pick what you would play next.";
    cta = `Pick track ${next}`;
    why = `You get this because you are in a track chain with ${other}.`;
  }

  const text = [
    head.join(" "),
    "",
    `${title} · ${e.chain.count} of ${e.chain.target}`,
    last ? `${lastLabel.charAt(0) + lastLabel.slice(1).toLowerCase()}: ${last.title}${lastMeta ? ` (${lastMeta})` : ""}` : "",
    "",
    body,
    "",
    `${cta}: ${url}`,
    "",
    "--",
    why,
    `Turn off chain emails: ${settings}`,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  const mono = "font-family:'Geist Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.12em;color:#57575A";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#EDEDEA;color:#111111;font-family:'Inter Tight',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEDEA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px">
<tr><td style="padding:28px 28px 0"><span style="font-size:20px;font-weight:800;letter-spacing:-0.03em">Selectorz</span></td></tr>
<tr><td style="padding:24px 28px 0;${mono}">${esc(eyebrow)}</td></tr>
<tr><td style="padding:10px 28px 0;font-size:34px;line-height:1;font-weight:800;letter-spacing:-0.045em">${esc(head[0])}<br>${esc(head[1])}</td></tr>
<tr><td style="padding:24px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:12px;color:#EDEDEA">
<tr><td style="padding:18px 20px 0;${mono};color:#A6A6AC">${esc(title.toUpperCase())} · ${e.chain.count} OF ${e.chain.target}</td></tr>
${last ? `<tr><td style="padding:14px 20px 0;${mono};color:#A6A6AC">${esc(lastLabel)}</td></tr>
<tr><td style="padding:4px 20px 0;font-size:22px;font-weight:800;letter-spacing:-0.03em">${esc(last.title)}</td></tr>
<tr><td style="padding:4px 20px 18px;font-size:14px;color:#C9C9C4">${esc(lastMeta)}</td></tr>` : `<tr><td style="padding:0 0 18px"></td></tr>`}
</table></td></tr>
<tr><td style="padding:20px 28px 0;font-size:16px;line-height:1.45">${esc(body)}</td></tr>
<tr><td style="padding:22px 28px 28px"><a href="${esc(url)}" style="display:inline-block;background:#111111;color:#EDEDEA;text-decoration:none;font-size:16px;font-weight:600;padding:16px 26px;border-radius:999px">${esc(cta)} &rarr;</a></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px"><tr><td style="padding:16px 8px;font-size:12px;line-height:1.5;color:#57575A">${esc(why)} <a href="${esc(settings)}" style="color:#57575A">Turn off chain emails</a></td></tr></table>
</td></tr></table></body></html>`;

  return { subject, text, html, headers: { "List-Unsubscribe": `<${settings}>` } };
}
