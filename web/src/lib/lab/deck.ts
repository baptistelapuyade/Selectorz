// Labor „Deck“: Logik für den sichtbaren offiziellen Player, Cue-Punkte und Spulen.
// Reine Funktionen, damit sie ohne Browser getestet werden können.

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

// "105", "1:45", "1:02:03", "1m45s" → Sekunden. Unsinn → 0.
export function parseTimestamp(raw: string | null | undefined): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return 0;
}

// YouTube-Link → Video-ID und Startzeit. Playlist-Parameter werden ignoriert.
export function parseYouTube(url: string): { id: string; start: number } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com") id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : "");
  else return null;
  if (!YT_ID.test(id)) return null;
  return { id, start: parseTimestamp(u.searchParams.get("t") ?? u.searchParams.get("start")) };
}

// Neue Position nach Spulen. Länge 0 = unbekannt, dann nur nach unten begrenzt.
export function seekTarget(current: number, delta: number, duration: number): number {
  const next = Math.max(0, Math.round(current + delta));
  return duration > 0 ? Math.min(next, Math.max(0, Math.floor(duration) - 1)) : next;
}

// Offizielles Bandcamp-Embed. Braucht die numerische Album-ID (steht im Teilen-Code des Albums).
export function bandcampEmbedSrc(albumId: string): string | null {
  if (!/^\d{1,12}$/.test(albumId)) return null;
  return `https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=large/bgcol=ffffff/linkcol=111111/tracklist=false/artwork=small/transparent=true/`;
}

// Offizielles SoundCloud-Widget, startet nicht von selbst (gesteuert über die Widget-API).
export function soundcloudWidgetSrc(url: string): string | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h !== "soundcloud.com") return null;
  } catch {
    return null;
  }
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&visual=false&show_comments=false&hide_related=true&show_teaser=false`;
}
