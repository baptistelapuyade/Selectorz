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

  // Rolle je Position: A spielt 1, 3, 5; B spielt 2, 4, 6 (Farben wie ROLE_COLOR)
  const color = (pos: number) => (pos % 2 ? "#8C93FF" : "#F0532A");
  const lastColor = color(Math.max(1, e.chain.count));
  const bars = Array.from({ length: e.chain.target }, (_, i) => {
    const pos = i + 1;
    const style = pos <= e.chain.count ? `background:${color(pos)}` : pos === e.chain.count + 1 && e.kind !== "completed" ? "border:1.5px dashed #EDEDEA" : "background:#2A2A2E";
    return `<td data-bar="${pos}" style="padding:0 ${i === e.chain.target - 1 ? 0 : 4}px 0 0"><div style="height:8px;box-sizing:border-box;border-radius:999px;${style}"></div></td>`;
  }).join("");
  const mono = "font-family:'Geist Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.12em;color:#57575A";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#EDEDEA;color:#111111;font-family:'Inter Tight',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEDEA"><tr><td align="center" style="padding:28px 12px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:4px 8px 0"><span style="font-size:16px;font-weight:800;letter-spacing:-0.03em">Selectorz</span></td></tr>
<tr><td style="padding:18px 8px 0;${mono};font-size:10px">${esc(eyebrow)}</td></tr>
<tr><td style="padding:12px 8px 0;font-size:40px;line-height:0.92;font-weight:800;letter-spacing:-0.05em">${esc(head[0])}<br>${esc(head[1])}</td></tr>
<tr><td style="padding:18px 8px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:10px;color:#EDEDEA">
<tr><td style="padding:16px 16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="${mono};font-size:10px;letter-spacing:0.1em;color:#A6A6AC">${esc(title.toUpperCase())}</td><td align="right" style="${mono};font-size:10px;letter-spacing:0.1em;color:#A6A6AC;white-space:nowrap">${e.chain.count} OF ${e.chain.target}</td></tr></table></td></tr>
<tr><td style="padding:14px 16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${bars}</tr></table></td></tr>
${last ? `<tr><td style="padding:14px 16px 0;${mono};font-size:10px;letter-spacing:0.1em;color:${lastColor}">${esc(lastLabel)}</td></tr>
<tr><td style="padding:4px 16px 0;font-size:26px;line-height:0.95;font-weight:800;letter-spacing:-0.035em">${esc(last.title)}</td></tr>
<tr><td style="padding:4px 16px 16px;font-size:13px;color:#C4C4C8">${esc(lastMeta)}</td></tr>` : `<tr><td style="padding:0 0 16px"></td></tr>`}
</table></td></tr>
<tr><td style="padding:18px 8px 0;font-size:15px;line-height:1.5">${esc(body)}</td></tr>
<tr><td style="padding:18px 8px 0"><a href="${esc(url)}" style="display:block;background:#111111;color:#EDEDEA;text-decoration:none;font-size:16px;font-weight:600;line-height:54px;padding:0 22px;border-radius:999px">${esc(cta)}<span style="float:right">&rarr;</span></a></td></tr>
<tr><td style="padding:32px 8px 0"><div style="border-top:1px solid #D2D2CE;padding:18px 0 26px;font-size:12px;line-height:1.5;color:#57575A">${esc(why)} <a href="${esc(settings)}" style="color:#57575A">Turn off chain emails</a></div></td></tr>
</table>
</td></tr></table></body></html>`;

  return { subject, text, html, headers: { "List-Unsubscribe": `<${settings}>` } };
}
