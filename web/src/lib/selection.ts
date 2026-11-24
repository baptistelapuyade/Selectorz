// Selections (M2 Teil 2a): Personenfarben, White label, Texte für Seite und Story.
import { ROLE_COLOR, firstName, type Role } from "@/lib/chains";
import { SITE } from "@/lib/story";

export type SelPerson = { role: Role; name: string; handle: string | null; color: string | null; instagram: string | null };
export type SelEntry = { position: number; role: Role; title: string; artist: string; url: string; comment: string };
export type Selection = { id: string; title: string; target: number; completed_at: string; participants: SelPerson[]; entries: SelEntry[] };
export type ProfileSelection = {
  id: string; title: string; completed_at: string;
  me: SelPerson; other: SelPerson; tracks: { title: string; artist: string }[];
};

export const STAMPS = ["SAME WAVE", "PROMO ONLY", "NOT FOR SALE", "TEST PRESSING"] as const;

// Gleiche Akzentfarbe: White label (PO 19.11.2026), sonst die Akzente der Personen; ohne Seite die Rollenfarbe
export function palette(people: Pick<SelPerson, "role" | "color">[]) {
  const a = people.find((p) => p.role === "A")?.color ?? ROLE_COLOR.A;
  const b = people.find((p) => p.role === "B")?.color ?? ROLE_COLOR.B;
  const white = a.toLowerCase() === b.toLowerCase();
  return { white, A: white ? "#F4F4F1" : a, B: white ? "#BDBDB8" : b } as const;
}

// Stempel: zufällig pro Selection, aber fest (aus der ID abgeleitet)
export function stampFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STAMPS[h % STAMPS.length];
}

export const selectionTitle = (s: { title: string }, a: string, b: string) => s.title.trim() || `${firstName(a)} × ${firstName(b)}`;
export const selectionPath = (id: string) => `/s/${id}`;
export const selectionUrl = (id: string) => `${SITE}/s/${id}`;
export const pickLabel = (e: { position: number }, names: Record<Role, string>, role: Role) =>
  e.position === 1 ? `${firstName(names[role])} picked` : `${firstName(names[role])} answered`;
