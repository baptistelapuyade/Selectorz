import { providerOf, PROVIDER_LABEL, SECTION_TITLES, type PublicProfile, type Section, type Track } from "@/lib/profile";

// Profil bearbeiten (M1c): Entwurf so, wie save_profile_draft / my_profile ihn liefern.
export type Kind = Section["kind"];
export type EditSection = { key: string; kind: Kind; title: string; visible: boolean; content: Record<string, unknown> };
export type EditDraft = {
  display_name: string;
  bio: string;
  city: string;
  genres: string[];
  plays: string[];
  look: "day" | "night";
  accent: string;
  photo_path: string | null;
  photo_style: "dots" | "bw";
  links: { label: string; url: string }[];
  sections: EditSection[];
};
export type EditState = {
  id: string;
  handle: string;
  status: "draft" | "published" | "withdrawn" | "suspended";
  published_at: string | null;
  changed: boolean;
  draft: EditDraft;
};

export const MAX_SECTIONS = 8;
export const BIO_MAX = 160;
export const TEXT_MAX = 280;
export const NOTE_MAX = 140;

// Schlüssel für die Liste: vom Server nach Position, neue Sections zufällig (nur im Browser erzeugt)
const newKey = () => `n-${globalThis.crypto.randomUUID()}`;

type RawSection = Omit<EditSection, "key">;
type RawDraft = Omit<EditDraft, "sections"> & { sections: RawSection[] };

export function fromServer(s: Omit<EditState, "draft"> & { draft: RawDraft }): EditState {
  return { ...s, draft: { ...s.draft, links: s.draft.links ?? [], sections: (s.draft.sections ?? []).map((x, i) => ({ ...x, key: `k${i}` })) } };
}

// Was an save_profile_draft geht (ohne die Schlüssel für die Liste)
export function toServer(d: EditDraft) {
  return { ...d, sections: d.sections.map((s) => ({ kind: s.kind, title: s.title, visible: s.visible, content: s.content })) };
}

// Gleicher Inhalt? (für „gespeichert“ und um unnötiges Speichern zu sparen)
export const sameDraft = (a: EditDraft, b: EditDraft) => JSON.stringify(toServer(a)) === JSON.stringify(toServer(b));

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const out = list.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

// Typen, die man hinzufügen kann (Proud transition und Links kommen mit Teil 2)
export const ADDABLE: { kind: Kind; desc: string }[] = [
  { kind: "star_track", desc: "The one track that says who you are." },
  { kind: "set_openers", desc: "One to three tracks you'd open with." },
  { kind: "set_closers", desc: "One to three tracks for the last ten minutes." },
  { kind: "mix", desc: "One mix of yours that plays right on your page." },
  { kind: "text", desc: "A few lines on how you play." },
];

export function newSection(kind: Kind): EditSection {
  const content: Record<string, unknown> =
    kind === "mix" ? { mixes: [] } : kind === "star_track" ? { track: null } : kind === "text" ? { text: "" } : { tracks: [] };
  return { key: newKey(), kind, title: SECTION_TITLES[kind], visible: true, content };
}

export const tracksOf = (s: EditSection): Track[] =>
  s.kind === "mix"
    ? ((s.content.mixes as Track[]) ?? [])
    : s.kind === "star_track"
      ? s.content.track ? [s.content.track as Track] : []
      : ((s.content.tracks as Track[]) ?? []);

export function filled(s: EditSection): boolean {
  if (s.kind === "text") return String(s.content.text ?? "").trim() !== "";
  if (s.kind === "transition") return !!s.content.url;
  return tracksOf(s).length > 0;
}

// Kurzbeschreibung in der Liste („3 tracks“, „1 mix · Late Hours Mix“)
export function summary(s: EditSection): string {
  if (!s.visible) return "Hidden from your page";
  if (s.kind === "text") {
    const len = String(s.content.text ?? "").length;
    return len ? `${len} of ${TEXT_MAX} characters` : "Empty, add a few lines";
  }
  if (s.kind === "transition") return s.content.url ? `From ${PROVIDER_LABEL[providerOf(String(s.content.url))]}` : "Empty";
  const tr = tracksOf(s);
  if (!tr.length) return "Empty, add a link";
  if (s.kind === "mix") return `1 mix · ${tr[0].title}`;
  if (s.kind === "star_track") return tr[0].title;
  return `${tr.length} track${tr.length === 1 ? "" : "s"}`;
}

export type Missing = "photo" | "name" | "sound" | "music";

// Was fehlt fürs Veröffentlichen (gleiche Regeln wie publish_profile)
export function missing(d: EditDraft): Missing[] {
  const out: Missing[] = [];
  if (!d.photo_path) out.push("photo");
  if (!d.display_name.trim()) out.push("name");
  if (!d.genres.length) out.push("sound");
  if (!d.sections.some((s) => s.visible && s.kind !== "text" && filled(s))) out.push("music");
  return out;
}

const MISSING_TEXT: Record<Missing, string> = { photo: "a photo", name: "your DJ name", sound: "your sound", music: "a visible track or mix" };
export function missingMessage(m: Missing[]) {
  const parts = m.map((x) => MISSING_TEXT[x]);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Add ${list} first. Your public page stays as it is.`;
}

// Vorschau: so sähe die öffentliche Seite mit diesem Entwurf aus
export function toPublic(handle: string, d: EditDraft): PublicProfile {
  return {
    handle,
    display_name: d.display_name || "Your name",
    bio: d.bio,
    city: d.city,
    genres: d.genres,
    plays: d.plays,
    look: d.look,
    accent: d.accent,
    photo_path: d.photo_path,
    photo_style: d.photo_style,
    links: d.links,
    sections: d.sections.filter((s) => s.visible && filled(s)).map((s) => ({ kind: s.kind, title: s.title, content: s.content }) as Section),
  };
}
