// Links fürs Profil (Board EditLinks): Adresse prüfen, Namen aus der Adresse vorschlagen.
export const MAX_LINKS = 6;

const NAMES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)soundcloud\.com$/, "SoundCloud"],
  [/(^|\.)mixcloud\.com$/, "Mixcloud"],
  [/(^|\.)(ra\.co|residentadvisor\.net)$/, "Resident Advisor"],
  [/(^|\.)bandcamp\.com$/, "Bandcamp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(tiktok\.com)$/, "TikTok"],
  [/(^|\.)(discogs\.com)$/, "Discogs"],
  [/(^|\.)(spotify\.com)$/, "Spotify"],
  [/(^|\.)(beatport\.com)$/, "Beatport"],
];

export function cleanLink(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".") || withScheme.length > 500) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function linkName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return NAMES.find(([re]) => re.test(h))?.[1] ?? "Website";
  } catch {
    return "Website";
  }
}

// Anzeige ohne https:// und ohne Schrägstrich am Ende
export const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
