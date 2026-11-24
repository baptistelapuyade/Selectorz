import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, expectError, newUser, pool, track } from "./db";

// Abnahme M1c Teil 1 „Profil bearbeiten“ (Plan vom 23.11.2026), Datenbank-Seite.
afterAll(() => pool.end());

const handle = () => `dj${randomUUID().replace(/-/g, "").slice(0, 10)}`;
const t = (n: number) => ({ ...track(n), provider: "soundcloud" });
const mix = (n = 1) => ({ kind: "mix", title: "My sound", visible: true, content: { mixes: [t(n)] } });
const openers = (n: number) => ({ kind: "set_openers", title: "Set openers", visible: true, content: { tracks: Array.from({ length: n }, (_, i) => t(i + 1)) } });
const text = (s: string) => ({ kind: "text", title: "How I play", visible: true, content: { text: s } });

async function live(user: string) {
  const h = handle();
  await as(user, (q) =>
    q("select public.create_and_publish_profile($1, 'Luma Reyes', '{House}', '{Vinyl}', 'Berlin', 'day', $2, $3)", [
      h,
      `${user}/avatar.png`,
      JSON.stringify({ kind: "mix", title: "My sound", content: { mixes: [t(1)] } }),
    ]),
  );
  return h;
}

type Draft = Record<string, unknown>;
const base = (user: string, extra: Draft = {}): Draft => ({
  display_name: "Luma Reyes",
  bio: "",
  city: "Berlin",
  genres: ["House"],
  plays: ["Vinyl"],
  look: "day",
  accent: "#8C93FF",
  photo_path: `${user}/avatar.png`,
  photo_style: "dots",
  sections: [mix()],
  ...extra,
});

const save = (user: string, d: Draft) => as(user, (q) => q("select public.save_profile_draft($1) as s", [JSON.stringify(d)])).then((r) => r.rows[0].s);
const publish = (user: string) => as(user, (q) => q("select * from public.publish_profile()"));
const mine = (user: string) => as(user, (q) => q("select public.my_profile() as s")).then((r) => r.rows[0].s);
const pub = (h: string) => as(null, (q) => q("select published from public.profiles where handle = $1", [h])).then((r) => r.rows[0]?.published ?? null);

describe("Entwurf speichern", () => {
  it("E1: Änderungen bleiben im Entwurf, die öffentliche Seite bleibt gleich, Status „changed“", async () => {
    const u = await newUser();
    const h = await live(u);
    expect((await mine(u)).changed).toBe(false);
    const s = await save(u, base(u, { display_name: "Luma R.", sections: [mix(), openers(2)] }));
    expect(s.changed).toBe(true);
    expect(s.draft.display_name).toBe("Luma R.");
    expect((await pub(h)).display_name).toBe("Luma Reyes");
  });

  it("E2: Wieder auf den alten Stand gebracht = keine Änderung mehr", async () => {
    const u = await newUser();
    await live(u);
    const { draft } = await mine(u);
    await save(u, { ...draft, city: "Leipzig" });
    const s = await save(u, draft);
    expect(s.changed).toBe(false);
  });

  it("E3: Ohne eigenes Profil gibt es nichts zu speichern; fremde Sections lassen sich nicht direkt ändern", async () => {
    const a = await newUser();
    const b = await newUser();
    await live(a);
    await expectError(save(b, base(b)), /no_profile/);
    const pid = (await admin((q) => q("select id from public.profiles where account_id = $1", [a]))).rows[0].id;
    const r = await as(b, (q) => q("update public.profile_sections set title = 'hacked' where profile_id = $1", [pid]));
    expect(r.rowCount).toBe(0);
    const d = await as(b, (q) => q("update public.profile_drafts set display_name = 'hacked' where profile_id = $1", [pid]));
    expect(d.rowCount).toBe(0);
  });

  it("E4: Höchstens 8 Sections", async () => {
    const u = await newUser();
    await live(u);
    await save(u, base(u, { sections: [mix(), ...Array.from({ length: 7 }, () => openers(1))] }));
    await expectError(save(u, base(u, { sections: [mix(), ...Array.from({ length: 8 }, () => openers(1))] })), /too_many_sections/);
  });

  it("E5: Ungültige Inhalte werden abgelehnt (Link ohne https, 4 Openers, zu langer Text)", async () => {
    const u = await newUser();
    await live(u);
    const bad = { kind: "set_openers", title: "x", visible: true, content: { tracks: [{ url: "http://x.y/a", title: "A" }] } };
    await expectError(save(u, base(u, { sections: [mix(), bad] })), /invalid_section/);
    await expectError(save(u, base(u, { sections: [openers(4)] })), /invalid_section/);
    await expectError(save(u, base(u, { sections: [mix(), text("x".repeat(281))] })), /invalid_section/);
  });

  it("E6: Auch direkt über RLS geht kein kaputter Inhalt in die Tabelle", async () => {
    const u = await newUser();
    await live(u);
    const pid = (await admin((q) => q("select id from public.profiles where account_id = $1", [u]))).rows[0].id;
    await expectError(
      as(u, (q) => q("insert into public.profile_sections (profile_id, kind, position, content) values ($1, 'mix', 2, $2)", [pid, JSON.stringify({ mixes: [{ url: "javascript:alert(1)", title: "x" }] })])),
      /profile_sections_content_ok/,
    );
  });

  it("E7: „About you“ höchstens 160 Zeichen; Farbe muss zum Look passen; Foto nur im eigenen Ordner", async () => {
    const u = await newUser();
    const other = await newUser();
    await live(u);
    await save(u, base(u, { bio: "x".repeat(160) }));
    await expectError(save(u, base(u, { bio: "x".repeat(161) })), /bio_check/);
    await expectError(save(u, base(u, { look: "night", accent: "#8C93FF".replace("8C93FF", "6EC1FF") })), /invalid_accent/);
    await expectError(save(u, base(u, { photo_path: `${other}/avatar.png` })), /invalid_photo/);
  });

  it("E8: Die Kopie für „verwerfen“ kann man nicht selbst überschreiben", async () => {
    const u = await newUser();
    await live(u);
    const pid = (await admin((q) => q("select id from public.profiles where account_id = $1", [u]))).rows[0].id;
    await expectError(as(u, (q) => q("update public.profile_drafts set last_published = '{}' where profile_id = $1", [pid])), /permission denied/);
  });
});

describe("Veröffentlichen, verwerfen, offline nehmen", () => {
  it("P1: „Publish changes“ ersetzt die öffentliche Fassung: neue Reihenfolge, ausgeblendete und leere Sections fehlen, About you ist dabei", async () => {
    const u = await newUser();
    const h = await live(u);
    const hidden = { ...openers(1), title: "Hidden", visible: false };
    const empty = { kind: "set_closers", title: "Set closers", visible: true, content: { tracks: [] } };
    await save(u, base(u, { display_name: "Luma R.", bio: "Sundays, slow and warm.", sections: [openers(2), hidden, empty, mix()] }));
    await publish(u);
    const p = await pub(h);
    expect(p.display_name).toBe("Luma R.");
    expect(p.bio).toBe("Sundays, slow and warm.");
    expect(p.sections.map((s: { kind: string }) => s.kind)).toEqual(["set_openers", "mix"]);
    expect((await mine(u)).changed).toBe(false);
  });

  it("P2: Ohne sichtbare Musik kein Veröffentlichen; die öffentliche Seite bleibt, wie sie war", async () => {
    const u = await newUser();
    const h = await live(u);
    await save(u, base(u, { sections: [{ ...mix(), visible: false }, text("Two decks, one rule.")] }));
    await expectError(publish(u), /needs_music_link/);
    await save(u, base(u, { photo_path: null }));
    await expectError(publish(u), /incomplete_profile/);
    expect((await pub(h)).sections).toHaveLength(1);
  });

  it("P3: „Discard changes“ holt den veröffentlichten Stand zurück, auch ausgeblendete Sections", async () => {
    const u = await newUser();
    await live(u);
    await save(u, base(u, { sections: [mix(), { ...openers(1), visible: false }] }));
    await publish(u);
    await save(u, base(u, { display_name: "Changed", sections: [text("only text")] }));
    const s = await as(u, (q) => q("select public.discard_profile_changes() as s")).then((r) => r.rows[0].s);
    expect(s.changed).toBe(false);
    expect(s.draft.display_name).toBe("Luma Reyes");
    expect(s.draft.sections.map((x: { kind: string; visible: boolean }) => [x.kind, x.visible])).toEqual([
      ["mix", true],
      ["set_openers", false],
    ]);
  });

  it("P4: Offline nehmen: ausgeloggt nicht mehr lesbar, Entwurf bleibt; erneut veröffentlichen geht", async () => {
    const u = await newUser();
    const h = await live(u);
    await as(u, (q) => q("select public.withdraw_profile()"));
    expect(await pub(h)).toBeNull();
    const m = await mine(u);
    expect(m.status).toBe("withdrawn");
    expect(m.draft.display_name).toBe("Luma Reyes");
    await publish(u);
    expect((await pub(h)).display_name).toBe("Luma Reyes");
  });

  it("P5: Die Adresse (Handle) lässt sich nach dem Veröffentlichen nicht mehr ändern", async () => {
    const u = await newUser();
    const h = await live(u);
    const r = await as(u, (q) => q("update public.profiles set handle = $1 where account_id = $2", [handle(), u]));
    expect(r.rowCount).toBe(0);
    expect((await mine(u)).handle).toBe(h);
  });

  it("P6: Ausgeloggt kein Zugriff auf die Bearbeiten-Funktionen", async () => {
    await expectError(as(null, (q) => q("select public.my_profile()")), /permission denied/);
    await expectError(as(null, (q) => q("select public.save_profile_draft('{}')")), /permission denied/);
    await expectError(as(null, (q) => q("select public.discard_profile_changes()")), /permission denied/);
  });
});

describe("Teil 2: Proud transition und Links", () => {
  const tr = (start: number, end: number) => ({
    kind: "transition",
    title: "Proud transition",
    visible: true,
    content: { url: "https://soundcloud.com/luma/live-at-paloma", title: "Live at Paloma", provider: "soundcloud", start, end, note: "Two records, one bassline." },
  });
  const links = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Link ${i + 1}`, url: `https://example.com/${i}` }));

  it("T1: Transition mit Start und Ende geht nach „Publish changes“ live", async () => {
    const u = await newUser();
    const h = await live(u);
    await save(u, base(u, { sections: [mix(), tr(2832, 2920)] }));
    await publish(u);
    const p = await pub(h);
    expect(p.sections[1]).toMatchObject({ kind: "transition", content: { start: 2832, end: 2920 } });
  });

  it("T2: Ende vor Start oder länger als 3 Minuten wird abgelehnt; leer angelegt ist erlaubt, geht aber nicht live", async () => {
    const u = await newUser();
    const h = await live(u);
    await expectError(save(u, base(u, { sections: [mix(), tr(300, 200)] })), /invalid_section/);
    await expectError(save(u, base(u, { sections: [mix(), tr(100, 281)] })), /invalid_section/);
    await save(u, base(u, { sections: [mix(), { kind: "transition", title: "Proud transition", visible: true, content: {} }] }));
    await publish(u);
    expect((await pub(h)).sections.map((s: { kind: string }) => s.kind)).toEqual(["mix"]);
  });

  it("L1: Links gehören zum Entwurf und gehen mit „Publish changes“ live", async () => {
    const u = await newUser();
    const h = await live(u);
    await save(u, base(u, { links: links(2) }));
    expect((await pub(h)).links).toEqual([]);
    await publish(u);
    expect((await pub(h)).links).toEqual(links(2));
  });

  it("L2: Höchstens 6 Links, nur https, Name nötig", async () => {
    const u = await newUser();
    await live(u);
    await save(u, base(u, { links: links(6) }));
    await expectError(save(u, base(u, { links: links(7) })), /invalid_links/);
    await expectError(save(u, base(u, { links: [{ label: "IG", url: "http://instagram.com/x" }] })), /invalid_links/);
    await expectError(save(u, base(u, { links: [{ label: " ", url: "https://instagram.com/x" }] })), /invalid_links/);
  });
});
