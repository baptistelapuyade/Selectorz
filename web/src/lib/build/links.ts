import { providerOf, type Provider } from "@/lib/profile";

export type CleanLink = { url: string; provider: Provider };

// Parameter, die nur Tracking sind und nichts am Track ändern.
const TRACKING = /^(utm_|si$|fbclid$|gclid$|igshid$|ref$|feature$|in$|p$|s$)/;

// Interne oder private Adressen nie annehmen (TRUST-02).
function privateHost(h: string) {
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h) ||
    h.includes(":") ||
    !h.includes(".")
  );
}

// Link aus dem Eingabefeld prüfen und bereinigen. Ungültig → null.
export function cleanTrackUrl(input: string): CleanLink | null {
  let s = input.trim();
  if (!s || s.length > 500) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (privateHost(host)) return null;
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  u.hash = "";
  const url = u.toString();
  if (url.length > 500) return null;
  return { url, provider: providerOf(url) };
}

// Offizielle oEmbed-Endpunkte (PROFILE-10). Feste Adressen: der Link geht nur als Parameter mit.
export function oembedEndpoint(provider: Provider, url: string): string | null {
  const q = `format=json&url=${encodeURIComponent(url)}`;
  if (provider === "soundcloud") return `https://soundcloud.com/oembed?${q}`;
  if (provider === "youtube") return `https://www.youtube.com/oembed?${q}`;
  if (provider === "mixcloud") return `https://app.mixcloud.com/oembed/?${q}`;
  return null;
}

// Profil- statt Track-Links erkennen: SoundCloud liefert dann den Profilnamen als „Titel“.
const SC_PROFILE_TABS = new Set(["tracks", "likes", "reposts", "albums", "popular-tracks", "followers", "following", "comments", "spotlight"]);
const MC_PROFILE_TABS = new Set(["uploads", "favorites", "listens", "playlists", "stream", "followers", "following", "reposts"]);

export function isProfileLink(url: string, provider: Provider): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const parts = u.pathname.split("/").filter(Boolean);
  if (provider === "soundcloud") return !u.hostname.startsWith("on.") && (parts.length === 1 || (parts.length === 2 && SC_PROFILE_TABS.has(parts[1])));
  if (provider === "mixcloud") return parts.length === 1 || (parts.length === 2 && MC_PROFILE_TABS.has(parts[1]));
  if (provider === "youtube") return /^(@|channel$|c$|user$)/.test(parts[0] ?? "") && !u.searchParams.has("v");
  return false;
}
