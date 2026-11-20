import type { Provider } from "@/lib/profile";

export type TrackMeta = { title: string; artist: string };

const clean = (s: unknown, max = 200) =>
  String(s ?? "")
    // Steuerzeichen aus fremden Daten entfernen
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Antwort eines oEmbed-Endpunkts in Titel und Artist übersetzen. Kein Titel → null (dann von Hand).
export function mapOembed(provider: Provider, json: unknown): TrackMeta | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { title?: unknown; author_name?: unknown };
  let title = clean(j.title, 400);
  const artist = clean(j.author_name);
  if (!title) return null;
  // SoundCloud liefert „Titel by Name“
  if (provider === "soundcloud" && artist) {
    const suffix = ` by ${artist}`;
    if (title.toLowerCase().endsWith(suffix.toLowerCase())) title = title.slice(0, -suffix.length).trim();
  }
  return { title: title.slice(0, 200), artist };
}
