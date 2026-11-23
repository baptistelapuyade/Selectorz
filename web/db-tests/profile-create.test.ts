import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, expectError, newUser, pool, track } from "./db";

// Abnahme M1b „Profil erstellen“ (Plan vom 20.11.2026), Datenbank-Seite.
afterAll(() => pool.end());

const handle = (tag = "dj") => `${tag}${randomUUID().replace(/-/g, "").slice(0, 10)}`;
const mix = () => ({ kind: "mix", title: "My sound", content: { mixes: [{ ...track(1), provider: "soundcloud" }] } });
const openers = (n: number) => ({
  kind: "set_openers",
  title: "Set openers",
  content: { tracks: Array.from({ length: n }, (_, i) => ({ ...track(i + 1), provider: "soundcloud" })) },
});

type Args = { handle: string; name?: string; genres?: string[]; photo?: string | null; section?: unknown; look?: string; plays?: string[]; city?: string; style?: string; accent?: string | null };

function create(user: string, a: Args) {
  return as(user, (q) =>
    q("select * from public.create_and_publish_profile($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [
      a.handle,
      a.name ?? "Luma Reyes",
      a.genres ?? ["Deep House"],
      a.plays ?? [],
      a.city ?? "",
      a.look ?? "day",
      a.photo === undefined ? `${user}/avatar.png` : a.photo,
      JSON.stringify(a.section ?? mix()),
      a.style ?? "dots",
      a.accent ?? null,
    ]),
  );
}

describe("create_and_publish_profile: Profil in einem Schritt anlegen und veröffentlichen", () => {
  it("A1: mit Name, Handle, Foto, Genre und Mix ist das Profil danach ausgeloggt lesbar", async () => {
    const u = await newUser();
    const h = handle();
    const { rows } = await create(u, { handle: h, city: "Berlin", plays: ["Vinyl"] });
    expect(rows[0].status).toBe("published");
    const pub = await as(null, (q) => q("select published from public.profiles where handle = $1", [h]));
    expect(pub.rows[0].published).toMatchObject({
      handle: h,
      display_name: "Luma Reyes",
      genres: ["Deep House"],
      city: "Berlin",
      plays: ["Vinyl"],
      look: "day",
      photo_path: `${u}/avatar.png`,
      photo_style: "dots",
      sections: [{ kind: "mix", title: "My sound" }],
    });
  });

  it("Weg „Tracks you love“: 1 bis 3 Set openers reichen", async () => {
    const u = await newUser();
    const { rows } = await create(u, { handle: handle(), section: openers(3) });
    expect(rows[0].published.sections[0].kind).toBe("set_openers");
    expect(rows[0].published.sections[0].content.tracks).toHaveLength(3);
  });

  it("Foto-Stil Schwarz-Weiß wird übernommen; unbekannte Stile werden abgewiesen", async () => {
    const u = await newUser();
    await expectError(create(u, { handle: handle(), style: "sepia" }), /invalid_photo/);
    const { rows } = await create(u, { handle: handle(), style: "bw", photo: `${u}/avatar-1.webp` });
    expect(rows[0].published).toMatchObject({ photo_style: "bw", photo_path: `${u}/avatar-1.webp` });
  });

  it("Akzentfarbe aus der Palette des Looks wird übernommen; fremde Farben werden abgewiesen (PROFILE-11)", async () => {
    const u = await newUser();
    await expectError(create(u, { handle: handle(), accent: "#123456" }), /invalid_accent/);
    await expectError(create(u, { handle: handle(), look: "day", accent: "#F0532A" }), /invalid_accent/); // Night-Farbe im Day-Look
    const { rows } = await create(u, { handle: handle(), look: "night", accent: "#3fd0e0" });
    expect(rows[0].published).toMatchObject({ look: "night", accent: "#3FD0E0" });
  });

  it("Entwürfe können keine Farbe außerhalb der Palette speichern", async () => {
    const u = await newUser();
    await create(u, { handle: handle() });
    await expectError(as(u, (q) => q("update public.profile_drafts set accent = '#000000'")), /profile_drafts_accent_palette|check constraint/);
  });

  it("Look Night setzt die passende Standard-Akzentfarbe", async () => {
    const u = await newUser();
    const { rows } = await create(u, { handle: handle(), look: "night" });
    expect(rows[0].published).toMatchObject({ look: "night", accent: "#F0532A" });
  });

  it("Pflichtangaben fehlen → verständlicher Fehler, nichts wird angelegt (A2)", async () => {
    const u = await newUser();
    await expectError(create(u, { handle: handle(), photo: null }), /incomplete_profile/);
    await expectError(create(u, { handle: handle(), genres: [] }), /incomplete_profile/);
    await expectError(create(u, { handle: handle(), name: "  " }), /incomplete_profile/);
    await expectError(create(u, { handle: handle(), section: openers(0) }), /needs_music_link/);
    const { rowCount } = await admin((q) => q("select 1 from public.profiles where account_id = $1", [u]));
    expect(rowCount).toBe(0);
  });

  it("ungültige Sections werden abgewiesen (nur Mix oder 1–3 Set openers, nur https)", async () => {
    const u = await newUser();
    await expectError(create(u, { handle: handle(), section: openers(4) }), /invalid_section/);
    await expectError(create(u, { handle: handle(), section: { kind: "text", content: { text: "hi" } } }), /invalid_section/);
    const bad = { kind: "mix", title: "My sound", content: { mixes: [{ url: "javascript:alert(1)", title: "x" }] } };
    await expectError(create(u, { handle: handle(), section: bad }), /invalid_section/);
  });

  it("das Foto muss im eigenen Ordner liegen", async () => {
    const u = await newUser();
    const other = await newUser();
    await expectError(create(u, { handle: handle(), photo: `${other}/avatar.png` }), /invalid_photo/);
    await expectError(create(u, { handle: handle(), photo: `../${u}/avatar.png` }), /invalid_photo/);
  });

  it("ein Konto hat höchstens ein Profil", async () => {
    const u = await newUser();
    await create(u, { handle: handle() });
    await expectError(create(u, { handle: handle() }), /profile_exists/);
  });

  it("ohne Anmeldung geht nichts", async () => {
    await expectError(
      as(null, (q) => q("select public.create_and_publish_profile('abc', 'x', '{a}', '{}', '', 'day', 'x/y.png', '{}', 'dots', null)")),
      /permission denied|not_authenticated/,
    );
  });
});

describe("Handles (PROFILE-01)", () => {
  it("vergebenes Handle → handle_taken", async () => {
    const h = handle();
    await create(await newUser(), { handle: h });
    await expectError(create(await newUser(), { handle: h }), /handle_taken/);
  });

  it("Groß-/Kleinschreibung zählt nicht", async () => {
    const h = handle();
    await create(await newUser(), { handle: h });
    await expectError(create(await newUser(), { handle: h.toUpperCase() }), /handle_taken|invalid_handle/);
  });

  it("reservierte Namen (auch neue Seiten wie /start, /imprint) sind gesperrt", async () => {
    const u = await newUser();
    for (const h of ["start", "imprint", "preview", "feedback", "settings"]) {
      await expectError(create(u, { handle: h }), /invalid_handle/);
    }
  });

  it("zwei gleichzeitige Versuche auf dasselbe Handle: genau einer gewinnt", async () => {
    const h = handle();
    const [a, b] = [await newUser(), await newUser()];
    const results = await Promise.allSettled([create(a, { handle: h }), create(b, { handle: h })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(lost.reason)).toMatch(/handle_taken/);
  });

  it("handle_available ist ohne Anmeldung abfragbar und verrät nur ja/nein", async () => {
    const h = handle();
    await create(await newUser(), { handle: h });
    const check = async (x: string) => (await as(null, (q) => q("select public.handle_available($1) as ok", [x]))).rows[0].ok;
    expect(await check(handle())).toBe(true);
    expect(await check(h)).toBe(false);
    expect(await check("settings")).toBe(false);
    expect(await check("A B")).toBe(false);
  });
});

describe("Foto-Speicher „avatars“ (TRUST-03)", () => {
  it("Bucket ist öffentlich lesbar, nur PNG/WebP, höchstens 1 MB", async () => {
    const { rows } = await admin((q) => q("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'"));
    expect(rows[0]).toEqual({ public: true, file_size_limit: "1048576", allowed_mime_types: ["image/png", "image/webp"] });
  });

  it("jede Person schreibt nur in ihren eigenen Ordner", async () => {
    const u = await newUser();
    const other = await newUser();
    await as(u, (q) => q("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${u}/a.png`]));
    await expectError(
      as(u, (q) => q("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${other}/a.png`])),
      /row-level security/,
    );
    await expectError(
      as(null, (q) => q("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${u}/b.png`])),
      /row-level security|permission denied/,
    );
  });

  // Löschen geht bei Supabase nur über die Speicher-API (direktes SQL-Löschen ist gesperrt); die Regel dafür
  // ist dieselbe wie fürs Ändern, daher prüfen wir hier das Ändern.
  it("fremde Fotos lassen sich nicht ändern", async () => {
    const u = await newUser();
    const other = await newUser();
    await as(u, (q) => q("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${u}/c.png`]));
    const upd = await as(other, (q) => q("update storage.objects set metadata = '{}' where name = $1", [`${u}/c.png`]));
    expect(upd.rowCount).toBe(0);
  });
});
