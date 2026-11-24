// Track-Ketten (M2): Typen und kleine Helfer für die Oberfläche.
export type Role = "A" | "B";
export type ChainState = "waiting_for_partner" | "active" | "completed" | "archived";

export type Entry = { position: number; role: Role; title: string; artist: string; url: string; comment: string; created_at: string };
export type Person = { role: Role; name: string; handle: string | null; me: boolean };
export type Chain = {
  id: string;
  title: string;
  state: ChainState;
  target: number;
  version: number;
  my_role: Role;
  my_turn: boolean;
  invite_open: boolean;
  participants: Person[];
  entries: Entry[];
};
export type Round = {
  id: string;
  title: string;
  state: ChainState;
  target: number;
  count: number;
  my_role: Role;
  my_turn: boolean;
  other: { name: string; handle: string | null } | null;
  last: { title: string; artist: string; mine: boolean } | null;
  updated_at: string;
};
export type Invite = {
  chain_id: string;
  title: string;
  state: ChainState;
  creator_name: string;
  creator_handle: string | null;
  track_title: string;
  track_artist: string;
  track_url: string;
  track_comment: string;
  target: number;
  invite_open: boolean;
  is_creator: boolean;
  is_participant: boolean;
};

// Personenfarben: A lila, B orange (Format Six, Boards Section 05)
export const ROLE_COLOR: Record<Role, string> = { A: "#8C93FF", B: "#F0532A" };

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const roundTitle = (r: { title: string; other: { name: string } | null }) => r.title || (r.other ? `With ${firstName(r.other.name)}` : "New round");

export type RoundGroup = "turn" | "waiting" | "open" | "complete" | "ended";
export function groupOf(r: Pick<Round, "state" | "my_turn">): RoundGroup {
  if (r.state === "archived") return "ended";
  if (r.state === "completed") return "complete";
  if (r.state === "waiting_for_partner") return "open";
  return r.my_turn ? "turn" : "waiting";
}

export function statusLine(r: Round): string {
  const other = r.other ? firstName(r.other.name) : null;
  switch (groupOf(r)) {
    case "turn":
      return `Your turn · track ${r.count + 1} of ${r.target}`;
    case "waiting":
      return `${other}’s turn · track ${r.count + 1} of ${r.target}`;
    case "open":
      return "Invite open · waiting for a DJ to answer";
    case "complete":
      return `Complete · ${r.target} tracks`;
    default:
      return `Ended · ${r.count} of ${r.target}`;
  }
}

// Gleiche Normalisierung wie private.url_key in der Datenbank (Duplikate vorab erkennen)
export const urlKey = (u: string) =>
  u.split("#")[0].split("?")[0].toLowerCase().replace(/^https:\/\/(www\.|m\.)?/, "").replace(/\/+$/, "");

export const inviteUrl = (origin: string, token: string) => `${origin}/invite/${token}`;

// „From your page“: einzelne Tracks aus den Abschnitten der eigenen Seite (keine Mixe: ein Track, kein ganzer Mix)
export type PageTrack = { url: string; title: string; artist: string };
export function pageTracks(sections: { kind: string; visible?: boolean; content: Record<string, unknown> }[]): PageTrack[] {
  const out: PageTrack[] = [];
  const add = (t: unknown) => {
    const x = t as { url?: string; title?: string; artist?: string } | null;
    if (!x?.url || !x.title || out.some((o) => urlKey(o.url) === urlKey(x.url!))) return;
    out.push({ url: x.url, title: x.title, artist: x.artist ?? "" });
  };
  for (const s of sections) {
    if (s.visible === false) continue;
    if (s.kind === "star_track") add(s.content.track);
    if (["set_openers", "set_closers", "tracks"].includes(s.kind)) for (const t of (s.content.tracks as unknown[]) ?? []) add(t);
  }
  return out;
}
