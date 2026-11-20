import { isHandle } from "@/lib/handles";
import type { Provider, Track } from "@/lib/profile";

// Entwurf beim Profil-Bau. Liegt bis zum Login nur im Browser (localStorage).
export type DraftTrack = Track & { provider: Provider; fetched?: "ok" | "failed" };
export type Draft = {
  path: "mix" | "tracks";       // eigener Mix oder „Tracks you love“
  step: "link" | "version";
  tracks: DraftTrack[];         // Mix: genau einer; Tracks you love: 1 bis 3
  displayName: string;
  nameTouched: boolean;         // Name selbst geändert → Vorschlag aus dem Link nicht mehr überschreiben
  handle: string;
  handleTouched: boolean;
  genres: string[];
  plays: string[];
  city: string;
  look: "day" | "night";
  photo: string | null;         // fertiges Raster als PNG-Data-URL, nie das Original
};

export const emptyDraft = (path: Draft["path"] = "mix"): Draft => ({
  path, step: "link", tracks: [], displayName: "", nameTouched: false, handle: "", handleTouched: false,
  genres: [], plays: [], city: "", look: "day", photo: null,
});

export type Missing = "name" | "handle" | "photo" | "sound" | "track";

// Was fehlt noch zum Veröffentlichen (PROFILE-02/04)?
export function missing(d: Draft): Missing[] {
  const out: Missing[] = [];
  if (!d.displayName.trim()) out.push("name");
  if (!isHandle(d.handle)) out.push("handle");
  if (!d.photo) out.push("photo");
  if (d.genres.length === 0) out.push("sound");
  if (!d.tracks.some((t) => t.url && t.title.trim())) out.push("track");
  return out;
}

export type Payload = {
  handle: string;
  displayName: string;
  genres: string[];
  plays: string[];
  city: string;
  look: "day" | "night";
  section: { kind: "mix" | "set_openers"; title: string; content: Record<string, unknown> };
};

const trackOut = (t: DraftTrack): Track & { provider: Provider } => ({
  url: t.url,
  title: t.title.trim(),
  ...(t.artist?.trim() ? { artist: t.artist.trim() } : {}),
  provider: t.provider,
});

// Was an den Server geht (ohne Foto; das wird vorher direkt in den Speicher geladen).
export function toPayload(d: Draft): Payload {
  const tracks = d.tracks.filter((t) => t.url && t.title.trim()).map(trackOut);
  const section: Payload["section"] =
    d.path === "mix"
      ? { kind: "mix", title: "My sound", content: { mixes: tracks.slice(0, 1) } }
      : { kind: "set_openers", title: "Set openers", content: { tracks: tracks.slice(0, 3) } };
  return {
    handle: d.handle.trim().toLowerCase(),
    displayName: d.displayName.trim().slice(0, 60),
    genres: d.genres.slice(0, 3),
    plays: d.plays.slice(0, 3),
    city: d.city.trim().slice(0, 60),
    look: d.look,
    section,
  };
}
