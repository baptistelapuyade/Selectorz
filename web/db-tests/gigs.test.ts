import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, expectError, newUser, pool, track } from "./db";

// Abnahme „Next gigs“ (Briefing vom 23.11.2026), Datenbank-Seite.
afterAll(() => pool.end());

async function live(user: string) {
  const h = `dj${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await as(user, (q) =>
    q("select public.create_and_publish_profile($1, 'Luma Reyes', '{House}', '{}', 'Berlin', 'day', $2, $3)", [
      h,
      `${user}/avatar.png`,
      JSON.stringify({ kind: "mix", title: "My sound", content: { mixes: [{ ...track(1), provider: "soundcloud" }] } }),
    ]),
  );
  const pid = (await admin((q) => q("select id from public.profiles where account_id = $1", [user]))).rows[0].id as string;
  return { h, pid };
}

const day = async (offset: number) =>
  (await admin((q) => q("select to_char(private.gig_day() + $1::int, 'YYYY-MM-DD') as d", [offset]))).rows[0].d as string;

const add = (user: string, pid: string, date: string, extra: Record<string, unknown> = {}) =>
  as(user, (q) =>
    q("insert into public.gigs (profile_id, date, event, city, url) values ($1, $2, $3, $4, $5) returning *", [
      pid,
      date,
      extra.event ?? "Late Hours at Kiez Klub",
      extra.city ?? "Berlin",
      extra.url ?? null,
    ]),
  ).then((r) => r.rows[0]);

const publicGigs = (pid: string) => as(null, (q) => q("select event, date from public.gigs where profile_id = $1 order by date", [pid])).then((r) => r.rows);

describe("Next gigs", () => {
  it("G1: Eingetragener Gig ist sofort öffentlich lesbar (ohne Veröffentlichen)", async () => {
    const u = await newUser();
    const { pid } = await live(u);
    await add(u, pid, await day(4));
    expect(await publicGigs(pid)).toHaveLength(1);
  });

  it("G2: Gig von gestern (nach 12 Uhr) ist öffentlich weg, bleibt aber für die Person gespeichert", async () => {
    const u = await newUser();
    const { pid } = await live(u);
    await add(u, pid, await day(-1), { event: "Played" });
    await add(u, pid, await day(0), { event: "Tonight" });
    expect((await publicGigs(pid)).map((g) => g.event)).toEqual(["Tonight"]);
    const own = await as(u, (q) => q("select event from public.gigs where profile_id = $1", [pid]));
    expect(own.rowCount).toBe(2);
  });

  it("G3: Nur die eigene Seite: fremde Gigs nicht eintragen, ändern oder löschen", async () => {
    const a = await newUser();
    const b = await newUser();
    const { pid } = await live(a);
    const g = await add(a, pid, await day(3));
    await expectError(add(b, pid, await day(3)), /row-level security/);
    const up = await as(b, (q) => q("update public.gigs set event = 'x' where id = $1", [g.id]));
    expect(up.rowCount).toBe(0);
    const del = await as(b, (q) => q("delete from public.gigs where id = $1", [g.id]));
    expect(del.rowCount).toBe(0);
  });

  it("G4: Ungültiger Link, leere Felder und unplausible Daten werden abgelehnt", async () => {
    const u = await newUser();
    const { pid } = await live(u);
    await expectError(add(u, pid, await day(2), { url: "ra.co events 2214" }), /gigs_url_check/);
    await expectError(add(u, pid, await day(2), { url: "javascript:alert(1)" }), /gigs_url_check/);
    await expectError(add(u, pid, await day(2), { event: "  " }), /gigs_event_check/);
    await expectError(add(u, pid, await day(-30)), /invalid_gig_date/);
    await expectError(add(u, pid, await day(800)), /invalid_gig_date/);
    const ok = await add(u, pid, await day(2), { url: "https://ra.co/events/2214", event: "  Kiez Klub " });
    expect(ok.event).toBe("Kiez Klub");
  });

  it("G5: Offline genommene Seite zeigt auch keine Gigs", async () => {
    const u = await newUser();
    const { pid } = await live(u);
    await add(u, pid, await day(5));
    await as(u, (q) => q("select public.withdraw_profile()"));
    expect(await publicGigs(pid)).toHaveLength(0);
  });

  it("G6: Höchstens 50 Gigs pro Seite", async () => {
    const u = await newUser();
    const { pid } = await live(u);
    const d = await day(10);
    await admin((q) =>
      q("insert into public.gigs (profile_id, date, event, city) select $1, $2::date, 'x' || i, 'Berlin' from generate_series(1, 50) i", [pid, d]),
    );
    await expectError(add(u, pid, d), /too_many_gigs/);
  });
});
