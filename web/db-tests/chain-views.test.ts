import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, newUser, pool, track } from "./db";

// M2 Teil 1: Lesefunktionen für die Oberfläche (Plan vom 24.11.2026).
afterAll(() => pool.end());

async function start(a: string) {
  const t = track(1);
  const { rows } = await as(a, (q) => q("select * from public.start_chain($1, $2, $3, $4, $5)", ["Slow Sunday", t.url, t.title, t.artist, "Starting slow."]));
  return rows[0] as { chain_id: string; invite_token: string };
}
const join = (b: string, token: string) => {
  const t = track(2);
  return as(b, (q) => q("select public.join_chain($1, $2, $3, $4, 'Answer.', $5)", [token, t.url, t.title, t.artist, randomUUID()]));
};
const view = (u: string, c: string) => as(u, (q) => q("select public.chain_view($1) as v", [c])).then((r) => r.rows[0].v);
const rounds = (u: string) => as(u, (q) => q("select public.my_rounds() as r")).then((r) => r.rows[0].r);
const peek = (u: string | null, token: string) => as(u, (q) => q("select * from public.peek_invite($1)", [token])).then((r) => r.rows[0]);

async function publishedProfile(user: string, name: string) {
  const h = `dj${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await as(user, (q) =>
    q("select public.create_and_publish_profile($1, $2, '{House}', '{}', 'Berlin', 'day', $3, $4)", [
      h,
      name,
      `${user}/avatar.png`,
      JSON.stringify({ kind: "mix", title: "My sound", content: { mixes: [{ ...track(9), provider: "soundcloud" }] } }),
    ]),
  );
  return h;
}

describe("Ketten lesen", () => {
  it("V1: Einladung zeigt den Seitennamen von A, Kommentar und Ziel; ausgeloggt lesbar, tritt nicht bei", async () => {
    const a = await newUser("");
    const h = await publishedProfile(a, "Luma Reyes");
    const { chain_id, invite_token } = await start(a);
    const p = await peek(null, invite_token);
    expect(p).toMatchObject({ creator_name: "Luma Reyes", creator_handle: h, track_comment: "Starting slow.", target: 6, invite_open: true, is_creator: false });
    const n = await admin((q) => q("select count(*)::int as n from public.chain_participants where chain_id = $1", [chain_id]));
    expect(n.rows[0].n).toBe(1);
    expect((await peek(a, invite_token)).is_creator).toBe(true);
  });

  it("V2: Meine Runden: A wartet, nach dem Beitritt ist A dran; Name von B ohne Seite = Kontoname", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const { chain_id, invite_token } = await start(a);
    let ra = await rounds(a);
    expect(ra[0]).toMatchObject({ id: chain_id, state: "waiting_for_partner", count: 1, my_turn: false, other: null });
    await join(b, invite_token);
    ra = await rounds(a);
    expect(ra[0]).toMatchObject({ state: "active", count: 2, my_turn: true, other: { name: "Kofi", handle: null }, last: { mine: false, position: 2, comment: "Answer.", url: expect.stringContaining("track-2-") } });
    const rb = await rounds(b);
    expect(rb[0]).toMatchObject({ my_role: "B", my_turn: false, other: { name: "Luma" } });
  });

  it("V3: Kettenansicht nur für Teilnehmende, mit Rollen je Track", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const c = await newUser("Ines");
    const { chain_id, invite_token } = await start(a);
    await join(b, invite_token);
    expect(await view(c, chain_id)).toBeNull();
    const v = await view(b, chain_id);
    expect(v.my_role).toBe("B");
    expect(v.entries.map((e: { role: string }) => e.role)).toEqual(["A", "B"]);
    expect(v.participants.map((p: { name: string; me: boolean }) => [p.name, p.me])).toEqual([["Luma", false], ["Kofi", true]]);
  });

  it("V4: Ohne Seite und ohne Namen heißt die Person „A Selectorz DJ“; Ausgeloggte sehen keine Runden", async () => {
    const a = await newUser("Luma");
    const b = await newUser("");
    const { invite_token } = await start(a);
    await join(b, invite_token);
    expect((await rounds(a))[0].other.name).toBe("A Selectorz DJ");
    await expect(as(null, (q) => q("select public.my_rounds()"))).rejects.toThrow(/permission denied/);
  });

  it("V5: Name beim Beitritt: eigener Kontoname ist änderbar und erscheint in der Kette; fremder nicht", async () => {
    const a = await newUser("Luma");
    const b = await newUser("");
    const { chain_id, invite_token } = await start(a);
    await as(b, (q) => q("update public.accounts set display_name = 'Kofi Mensah' where id = $1", [b]));
    const other = await as(b, (q) => q("update public.accounts set display_name = 'Hacked' where id = $1", [a]));
    expect(other.rowCount).toBe(0);
    await join(b, invite_token);
    const v = await view(a, chain_id);
    expect(v.participants.find((p: { role: string }) => p.role === "B").name).toBe("Kofi Mensah");
    expect(v.participants.find((p: { role: string }) => p.role === "A").name).toBe("Luma");
  });

  it("V6: Vergebene Einladung zeigt nur den Vornamen der zweiten Person; offene Einladung zeigt niemanden", async () => {
    const a = await newUser("");
    await publishedProfile(a, "Luma Reyes");
    const { invite_token } = await start(a);
    expect(await peek(null, invite_token)).toMatchObject({ partner_name: null, partner_color: null });
    const b = await newUser("Ines Okafor");
    await join(b, invite_token);
    const p = await peek(null, invite_token);
    expect(p).toMatchObject({ state: "active", partner_name: "Ines", invite_open: false });
    expect(p.creator_color).not.toBeUndefined();
  });

  it("V7: Beendete Runde merkt sich, wer beendet hat", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const { chain_id, invite_token } = await start(a);
    await join(b, invite_token);
    await as(b, (q) => q("select public.end_chain($1)", [chain_id]));
    expect(await view(b, chain_id)).toMatchObject({ state: "archived", ended_by_me: true });
    expect(await view(a, chain_id)).toMatchObject({ state: "archived", ended_by_me: false });
  });
});
