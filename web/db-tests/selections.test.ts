import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { as, expectError, newUser, pool, track } from "./db";

// M2 Teil 2a: gemeinsame Freigabe und öffentliche Selection (Plan vom 24.11.2026, PRD 22 Nr. 13, 15, 16).
afterAll(() => pool.end());

async function publishedProfile(user: string, name: string, accent = "#8C93FF", instagram?: string) {
  const h = `dj${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await as(user, (q) =>
    q("select public.create_and_publish_profile($1, $2, '{House}', '{}', 'Berlin', 'day', $3, $4)", [
      h, name, `${user}/avatar.png`,
      JSON.stringify({ kind: "mix", title: "My sound", content: { mixes: [{ ...track(9), provider: "soundcloud" }] } }),
    ]),
  );
  await as(user, (q) => q("update public.profile_drafts set accent = $2, links = $3 where profile_id = (select id from public.profiles where account_id = $1)", [
    user, accent, JSON.stringify(instagram ? [{ label: "Instagram", url: `https://www.instagram.com/${instagram}/` }] : []),
  ]));
  await as(user, (q) => q("select public.publish_profile()"));
  return h;
}

async function fullChain(a: string, b: string) {
  const t1 = track(1);
  const { rows } = await as(a, (q) => q("select * from public.start_chain('Slow Sunday', $1, $2, $3, '', $4)", [t1.url, t1.title, t1.artist, randomUUID()]));
  const { chain_id, invite_token } = rows[0];
  const t2 = track(2);
  await as(b, (q) => q("select public.join_chain($1, $2, $3, $4, '', $5)", [invite_token, t2.url, t2.title, t2.artist, randomUUID()]));
  for (let pos = 3; pos <= 6; pos++) {
    const t = track(pos);
    await as(pos % 2 ? a : b, (q) => q("select * from public.add_track($1, $2, $3, $4, $5, '', $6)", [chain_id, pos, t.url, t.title, t.artist, randomUUID()]));
  }
  return chain_id as string;
}

const approve = (u: string, c: string, yes = true) => as(u, (q) => q("select public.set_chain_approval($1, $2)", [c, yes]));
const sel = (u: string | null, c: string) => as(u, (q) => q("select public.selection_view($1) as v", [c])).then((r) => r.rows[0].v);
const onProfile = (h: string) => as(null, (q) => q("select public.profile_selections($1) as v", [h])).then((r) => r.rows[0].v);
const view = (u: string, c: string) => as(u, (q) => q("select public.chain_view($1) as v", [c])).then((r) => r.rows[0].v);

describe("Selections", () => {
  it("S1: öffentlich erst mit beiden Freigaben; davor null, auch für Teilnehmende über selection_view", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const h = await publishedProfile(a, "Luma Reyes", "#8C93FF", "luma.reyes");
    const c = await fullChain(a, b);
    expect(await sel(null, c)).toBeNull();
    await approve(a, c);
    expect(await sel(null, c)).toBeNull();
    expect(await sel(a, c)).toBeNull();
    expect(await onProfile(h)).toEqual([]);
    const v = await view(a, c);
    expect(v.public).toBe(false);
    expect(v.participants.map((p: { approved: boolean }) => p.approved)).toEqual([true, false]);
    await approve(b, c);
    const s = await sel(null, c);
    expect(s.entries).toHaveLength(6);
    expect(s.participants[0]).toMatchObject({ role: "A", name: "Luma Reyes", handle: h, color: "#8C93FF", instagram: "luma.reyes" });
    expect(s.participants[1]).toMatchObject({ role: "B", name: "Kofi", handle: null, color: null, instagram: null });
    const list = await onProfile(h);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: c, title: "Slow Sunday", other: { name: "Kofi" } });
    expect(list[0].tracks).toHaveLength(3);
  });

  it("S2: Widerruf nimmt die Seite sofort zurück, Profil bleibt", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const h = await publishedProfile(a, "Luma Reyes");
    const c = await fullChain(a, b);
    await approve(a, c);
    await approve(b, c);
    expect(await sel(null, c)).not.toBeNull();
    await approve(b, c, false);
    expect(await sel(null, c)).toBeNull();
    expect(await onProfile(h)).toEqual([]);
    const r = await as(null, (q) => q("select count(*)::int as n from public.profiles where handle = $1 and status = 'published'", [h]));
    expect(r.rows[0].n).toBe(1);
  });

  it("S3: Freigabe nur bei fertiger Kette und nur für Teilnehmende; Fremde ändern nichts", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const c3 = await newUser("Mallory");
    const c = await fullChain(a, b);
    await expectError(approve(c3, c), /not_allowed/);
    const t1 = track(1);
    const { rows } = await as(a, (q) => q("select * from public.start_chain('', $1, $2, $3, '', $4)", [t1.url, t1.title, t1.artist, randomUUID()]));
    await expectError(approve(a, rows[0].chain_id), /chain_not_completed/);
  });

  it("S4: my_rounds zeigt Freigabestand für Home", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const c = await fullChain(a, b);
    await approve(b, c);
    const r = await as(a, (q) => q("select public.my_rounds() as r")).then((x) => x.rows[0].r);
    expect(r.find((x: { id: string }) => x.id === c)).toMatchObject({ my_yes: false, other_yes: true, public: false });
  });

  it("S5: Foto der veröffentlichten Seite in der Selection", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    await publishedProfile(a, "Luma Reyes");
    const c = await fullChain(a, b);
    await approve(a, c);
    await approve(b, c);
    const s = await sel(null, c);
    expect(s.participants[0].photo).toMatchObject({ path: `${a}/avatar.png`, style: "dots" });
    expect(s.participants[1].photo).toBeNull();
  });

  // Name gemeinsam (PO 27.11.2026, Boards Abschluss · Name A/B/C): Vorschlag, Zustimmung der anderen Person
  const suggest = (u: string, c: string, t: string) => as(u, (q) => q("select public.suggest_chain_title($1, $2)", [c, t]));
  const accept = (u: string, c: string) => as(u, (q) => q("select public.accept_chain_title($1)", [c]));

  it("S6: Startname gilt als Vorschlag der startenden Person; die andere stimmt zu", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const c = await fullChain(a, b);
    expect(await view(b, c)).toMatchObject({ title: "Slow Sunday", title_suggestion: "Slow Sunday", title_suggested_by_me: false, title_together: false });
    expect(await view(a, c)).toMatchObject({ title_suggestion: "Slow Sunday", title_suggested_by_me: true });
    await expectError(accept(a, c), /not_allowed/);
    await accept(b, c);
    expect(await view(a, c)).toMatchObject({ title: "Slow Sunday", title_suggestion: null, title_together: true });
  });

  it("S7: Ein Vorschlag ändert den gültigen Namen erst nach Zustimmung; Gegenvorschlag braucht die andere Person", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const c = await fullChain(a, b);
    await suggest(a, c, "  Sunday Glow  ");
    expect(await view(b, c)).toMatchObject({ title: "Slow Sunday", title_suggestion: "Sunday Glow", title_suggested_by_me: false });
    await suggest(b, c, "Late Bloom");
    await expectError(accept(b, c), /not_allowed/);
    expect((await view(a, c)).title).toBe("Slow Sunday");
    await accept(a, c);
    expect(await view(b, c)).toMatchObject({ title: "Late Bloom", title_suggestion: null, title_together: true });
    // Neuer Vorschlag nach Einigung: Name bleibt bis zur Zustimmung, „together“ gilt weiter für den gültigen Namen
    await suggest(b, c, "Night Swim");
    expect(await view(a, c)).toMatchObject({ title: "Late Bloom", title_suggestion: "Night Swim", title_together: true });
  });

  it("S8: Fremde dürfen weder vorschlagen noch zustimmen; leere oder zu lange Namen", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const m = await newUser("Mallory");
    const c = await fullChain(a, b);
    await expectError(suggest(m, c, "Mine now"), /not_allowed/);
    await expectError(accept(m, c), /not_allowed/);
    await expectError(suggest(a, c, "   "), /empty_title/);
    await suggest(a, c, "x".repeat(80));
    expect((await view(b, c)).title_suggestion).toHaveLength(60);
    await expectError(as(a, (q) => q("select public.rename_chain($1, 'x')", [c])), /does not exist/);
  });

  it("S9: Ohne Startnamen gibt es keinen Vorschlag", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const t1 = track(1);
    const { rows } = await as(a, (q) => q("select * from public.start_chain('', $1, $2, $3, '', $4)", [t1.url, t1.title, t1.artist, randomUUID()]));
    const t2 = track(2);
    await as(b, (q) => q("select public.join_chain($1, $2, $3, $4, '', $5)", [rows[0].invite_token, t2.url, t2.title, t2.artist, randomUUID()]));
    expect(await view(a, rows[0].chain_id)).toMatchObject({ title: "", title_suggestion: null, title_together: false });
    await expectError(accept(b, rows[0].chain_id), /no_suggestion/);
  });
});
