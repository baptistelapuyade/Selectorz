// Öffentliche Momentaufnahme eines Profils (so wie publish_profile sie speichert).
export type Track = { url: string; title: string; artist?: string; provider?: string };
export type Section =
  | { kind: "star_track"; title?: string; content: { track: Track; note?: string } }
  | { kind: "set_openers" | "set_closers" | "tracks"; title?: string; content: { tracks: Track[]; note?: string } }
  | { kind: "mix"; title?: string; content: { mixes: (Track & { label?: string })[] } }
  | { kind: "transition"; title?: string; content: { url: string; title?: string; start: number; end: number; note?: string; provider?: string } }
  | { kind: "text"; title?: string; content: { text: string } };

export type PublicProfile = {
  handle: string;
  display_name: string;
  bio?: string;
  city?: string;
  genres: string[];
  plays: string[];
  look: "day" | "night";
  accent: string;
  photo_path?: string | null;
  photo_style?: "dots" | "bw";
  links: { label: string; url: string }[];
  sections: Section[];
};

export const SECTION_TITLES: Record<Section["kind"], string> = {
  star_track: "Star track",
  set_openers: "Set openers",
  set_closers: "Set closers",
  tracks: "Records I carry",
  mix: "My sound",
  transition: "Proud transition",
  text: "How I play",
};

// Look-Tokens aus den Boards „Profil Day/Night“; die Akzentfarbe der Person ersetzt den Look-Akzent.
export function lookTokens(look: "day" | "night", accent: string) {
  if (look === "night") {
    return {
      bg: "#0B0B0C", fg: "#F2F2F0", muted: "#9A9AA0", line: "#2E2E33", line2: "#26262A", surface: "#141416",
      accent, onAccent: "#0B0B0C", hl: "#C9B8FF", hlFg: "#0B0B0C", tickBg: accent, tickFg: "#0B0B0C",
      btnBg: "#F2F2F0", btnFg: "#0B0B0C", segBg: "#1A1A1D", s1: "#C9B8FF", s1fg: "#0B0B0C", s2: accent, s2fg: "#0B0B0C",
      s3: "#1F1F22", s3fg: "#F2F2F0", htBg: "#0B0B0C", htDot: accent, ctaBg: "#151517", footBg: accent, footFg: "#0B0B0C",
    };
  }
  return {
    bg: "#F3F1EC", fg: "#111111", muted: "#55524C", line: "#111111", line2: "#CFCBC1", surface: "#FFFFFF",
    accent, onAccent: "#111111", hl: "#E4F45A", hlFg: "#111111", tickBg: "#111111", tickFg: "#F3F1EC",
    btnBg: "#111111", btnFg: "#F3F1EC", segBg: "#E2DFD7", s1: "#E4F45A", s1fg: "#111111", s2: accent, s2fg: "#111111",
    s3: "#D4D1C8", s3fg: "#111111", htBg: accent, htDot: "#111111", ctaBg: "#E8E5DD", footBg: "#111111", footFg: "#F3F1EC",
  };
}

export type Provider = "soundcloud" | "youtube" | "mixcloud" | "bandcamp" | "other";

export function providerOf(url: string): Provider {
  try {
    const h = new URL(url).hostname.replace(/^www\.|^m\./, "");
    if (h.endsWith("soundcloud.com") || h === "on.soundcloud.com") return "soundcloud";
    if (h === "youtube.com" || h === "youtu.be" || h === "music.youtube.com") return "youtube";
    if (h.endsWith("mixcloud.com")) return "mixcloud";
    if (h.endsWith("bandcamp.com")) return "bandcamp";
  } catch {}
  return "other";
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  soundcloud: "SoundCloud", youtube: "YouTube", mixcloud: "Mixcloud", bandcamp: "Bandcamp", other: "Link",
};

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? "";
  } catch {
    return "";
  }
}

// Offizielle Einbettungen (MEDIA-07). Nur nach Tippen geladen (Zwei-Klick).
export function embedSrc(url: string, startSeconds = 0): string | null {
  const p = providerOf(url);
  if (p === "soundcloud")
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&visual=false&show_comments=false&hide_related=true${startSeconds ? `#t=${Math.floor(startSeconds)}` : ""}`;
  if (p === "youtube") {
    const id = youtubeId(url);
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1${startSeconds ? `&start=${Math.floor(startSeconds)}` : ""}` : null;
  }
  if (p === "mixcloud") {
    const path = new URL(url).pathname;
    return `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&autoplay=1&feed=${encodeURIComponent(path)}`;
  }
  return null; // Bandcamp braucht die Album-ID; dort nur Link nach außen
}

export function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function photoUrl(path?: string | null, look: "day" | "night" = "day", style: "dots" | "bw" = "dots") {
  if (!path) return null;
  // Raster: für Night liegt daneben die Maske mit Punkten für Licht (<name>-night.png)
  const file = style === "dots" && look === "night" ? path.replace(/\.(png|webp)$/, "-night.$1") : path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${file}`;
}
