// Next gigs: Datum, Beschriftung und Sichtbarkeit (Briefing 23.11.2026).
export type Gig = { id: string; date: string; event: string; city: string; url: string | null };

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Datum ohne Zeitzone (YYYY-MM-DD) → Wochentag, Tag, Monat. Immer in UTC rechnen, sonst verrutscht der Tag.
export function gigDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return { wd: WD[t.getUTCDay()], day: String(d).padStart(2, "0"), mon: MON[m - 1], year: y };
}

// „Fri 27 Nov“ (mit Jahr, wenn nicht das aktuelle)
export function gigLabel(date: string, today = gigToday()) {
  const g = gigDate(date);
  const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  const sameYear = g.year === Number(today.slice(0, 4));
  return `${cap(g.wd)} ${g.day} ${cap(g.mon)}${sameYear ? "" : ` ${g.year}`}`;
}

// „Heute“ für Gigs wie in der Datenbank: Berlin, bis 12 Uhr mittags gilt noch der Vortag
export function gigToday(now = new Date()): string {
  const shifted = new Date(now.getTime() - 12 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
}

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export const isUpcoming = (date: string, today = gigToday()) => days(today, date) >= 0;

// „TONIGHT“, „TOMORROW“, „IN 4 DAYS“
export function untilLabel(date: string, today = gigToday()) {
  const n = days(today, date);
  if (n <= 0) return "TONIGHT";
  if (n === 1) return "TOMORROW";
  return `IN ${n} DAYS`;
}

// Beschriftung des Links aus der Adresse (RA, Instagram, sonst Tickets)
export function linkLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h === "ra.co" || h.endsWith(".ra.co") || h === "residentadvisor.net") return "RA";
    if (h === "instagram.com" || h.endsWith(".instagram.com")) return "Instagram";
    if (h.endsWith("facebook.com")) return "Facebook";
  } catch {
    return null;
  }
  return "Tickets";
}

// Link vor dem Speichern prüfen: „ra.co/events/1“ wird https://…, Leerzeichen oder ohne Punkt → ungültig
export function cleanGigUrl(raw: string): { ok: true; url: string | null } | { ok: false } {
  const v = raw.trim();
  if (!v) return { ok: true, url: null };
  const withScheme = /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (/\s/.test(v) || !u.hostname.includes(".") || withScheme.length > 500) return { ok: false };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false };
  }
}

export const upcoming = (gigs: Gig[], today = gigToday()) => gigs.filter((g) => isUpcoming(g.date, today)).sort((a, b) => a.date.localeCompare(b.date));
export const played = (gigs: Gig[], today = gigToday()) => gigs.filter((g) => !isUpcoming(g.date, today)).sort((a, b) => b.date.localeCompare(a.date));
