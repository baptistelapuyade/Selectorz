import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, expectError, newUser, pool, track } from "./db";

afterAll(() => pool.end());

async function startChain(a: string) {
  const t = track(1);
  const { rows } = await as(a, (q) =>
    q("select * from public.start_chain($1, $2, $3, $4)", ["Slow Sunday", t.url, t.title, t.artist]),
  );
  return rows[0] as { chain_id: string; invite_token: string };
}

async function join(b: string, token: string, request = randomUUID()) {
  const t = track(2);
  return as(b, (q) => q("select public.join_chain($1, $2, $3, $4, '', $5) as id", [token, t.url, t.title, t.artist, request]));
}

async function add(user: string, chain: string, position: number, request = randomUUID()) {
  const t = track(position);
  return as(user, (q) =>
    q("select * from public.add_track($1, $2, $3, $4, $5, '', $6)", [chain, position, t.url, t.title, t.artist, request]),
  );
}

async function fullChain() {
  const a = await newUser("Luma");
  const b = await newUser("Kofi");
  const { chain_id, invite_token } = await startChain(a);
  await join(b, invite_token);
  for (let pos = 3; pos <= 6; pos++) await add(pos % 2 === 1 ? a : b, chain_id, pos);
  return { a, b, chain: chain_id };
}

async function makeProfile(user: string, handle: string, complete = true) {
  await as(user, async (q) => {
    const { rows } = await q("insert into public.profiles (account_id, handle) values ($1, $2) returning id", [user, handle]);
    const id = rows[0].id;
    await q(
      "insert into public.profile_drafts (profile_id, display_name, genres, photo_path) values ($1, $2, $3, $4)",
      [id, complete ? "Luma Reyes" : "", complete ? ["House"] : [], complete ? "p/x.jpg" : null],
    );
    if (complete) {
      await q("insert into public.profile_sections (profile_id, kind, position, content) values ($1, 'mix', 1, $2)", [
        id,
        { mixes: [{ url: "https://soundcloud.com/luma/mix", title: "Late Hours Mix" }] },
      ]);
    }
  });
}

describe("1 · Profil: Entwurf, Veröffentlichen, Zurückziehen (A1–A4, PROFILE-03/04/06/07)", () => {
  it("Entwurf ist öffentlich unsichtbar, Veröffentlichen zeigt nur die Momentaufnahme, Zurückziehen versteckt", async () => {
    const u = await newUser();
    const handle = `luma${Date.now()}`;
    await makeProfile(u, handle);
    const anonSees = () => as(null, (q) => q("select handle, published from public.profiles where handle = $1", [handle]));

    expect((await anonSees()).rowCount).toBe(0);
    await as(null, async (q) => expect((await q("select * from public.profile_drafts")).rowCount).toBe(0));

    await as(u, (q) => q("select public.publish_profile()"));
    const pub = await anonSees();
    expect(pub.rowCount).toBe(1);
    expect(pub.rows[0].published.display_name).toBe("Luma Reyes");

    // Entwurf ändern verändert die öffentliche Fassung nicht (A3)
    await as(u, (q) => q("update public.profile_drafts set display_name = 'New Name' where profile_id = (select id from public.profiles where account_id = $1)", [u]));
    expect((await anonSees()).rows[0].published.display_name).toBe("Luma Reyes");

    await as(u, (q) => q("select public.withdraw_profile()"));
    expect((await anonSees()).rowCount).toBe(0);
  });

  it("unvollständiges Profil kann nicht veröffentlicht werden (A2)", async () => {
    const u = await newUser();
    await makeProfile(u, `half${Date.now()}`, false);
    await expectError(as(u, (q) => q("select public.publish_profile()")), /incomplete_profile/);
  });

  it("Status und Admin-Rechte lassen sich nicht direkt setzen", async () => {
    const u = await newUser();
    await makeProfile(u, `sneaky${Date.now()}`);
    await expectError(as(u, (q) => q("update public.profiles set status = 'published' where account_id = $1", [u])), /permission denied/);
    await expectError(as(u, (q) => q("update public.accounts set is_admin = true where id = $1", [u])), /permission denied/);
  });
});

describe("2 · Handle ist eindeutig (PROFILE-01)", () => {
  it("zwei Personen wollen gleichzeitig denselben Handle: genau eine bekommt ihn", async () => {
    const [u1, u2] = [await newUser(), await newUser()];
    const handle = `same${Date.now()}`;
    const results = await Promise.allSettled([makeProfile(u1, handle), makeProfile(u2, handle.toUpperCase())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("reservierte und ungültige Handles werden abgewiesen", async () => {
    const u = await newUser();
    await expectError(makeProfile(u, "login"), /check/);
    await expectError(makeProfile(u, "a"), /check/);
  });
});

describe("3 · Beitritt (B9, B10, CHAIN-02..04)", () => {
  it("A kann den Platz von B nicht selbst belegen", async () => {
    const a = await newUser();
    const { invite_token } = await startChain(a);
    await expectError(join(a, invite_token), /own_invite/);
  });

  it("zwei gleichzeitige Beitritte: genau einer gewinnt, der andere sieht 'chain_taken'", async () => {
    const a = await newUser();
    const [b, c] = [await newUser(), await newUser()];
    const { chain_id, invite_token } = await startChain(a);
    const results = await Promise.allSettled([join(b, invite_token), join(c, invite_token)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(String(bad[0].reason)).toMatch(/chain_taken/);
    const { rows } = await admin((q) => q("select count(*)::int n from public.chain_participants where chain_id = $1", [chain_id]));
    expect(rows[0].n).toBe(2);
  });

  it("Einladung ansehen tritt nicht bei (CHAIN-03)", async () => {
    const a = await newUser("Luma");
    const { chain_id, invite_token } = await startChain(a);
    const { rows } = await as(null, (q) => q("select * from public.peek_invite($1)", [invite_token]));
    expect(rows[0].creator_name).toBe("Luma");
    expect(rows[0].invite_open).toBe(true);
    const n = await admin((q) => q("select count(*)::int n from public.chain_participants where chain_id = $1", [chain_id]));
    expect(n.rows[0].n).toBe(1);
  });
});

describe("4 · Nur wer dran ist, darf schreiben (B11, CHAIN-05)", () => {
  it("B ist nach Track 2 nicht dran; direkter Insert an der Funktion vorbei geht nicht", async () => {
    const a = await newUser();
    const b = await newUser();
    const { chain_id, invite_token } = await startChain(a);
    await join(b, invite_token);
    await expectError(add(b, chain_id, 3), /not_your_turn/);
    await expectError(
      as(b, (q) =>
        q("insert into public.chain_entries (chain_id, position, author_id, url, url_key, title, request_id) values ($1, 3, $2, 'https://x.y/z', 'x', 't', gen_random_uuid())", [chain_id, b]),
      ),
      /row-level security|permission denied/,
    );
    await add(a, chain_id, 3);
  });

  it("Außenstehende können nicht schreiben und nichts lesen", async () => {
    const a = await newUser();
    const outsider = await newUser();
    const { chain_id } = await startChain(a);
    await expectError(add(outsider, chain_id, 2), /not_allowed/);
    const { rowCount } = await as(outsider, (q) => q("select * from public.chain_entries where chain_id = $1", [chain_id]));
    expect(rowCount).toBe(0);
  });
});

describe("5 · Doppelte Anfrage = ein Track, eine Mail (B12, CHAIN-07, NOTIFY-01)", () => {
  it("gleiche Anfrage zweimal (auch gleichzeitig) ergibt genau einen Eintrag und eine Benachrichtigung", async () => {
    const a = await newUser();
    const b = await newUser();
    const { chain_id, invite_token } = await startChain(a);
    await join(b, invite_token);
    const req = randomUUID();
    const t = track(3);
    const call = () =>
      as(a, (q) => q("select * from public.add_track($1, 3, $2, $3, $4, '', $5)", [chain_id, t.url, t.title, t.artist, req]));
    await Promise.allSettled([call(), call()]);
    await call();
    const e = await admin((q) => q("select count(*)::int n from public.chain_entries where chain_id = $1 and position = 3", [chain_id]));
    expect(e.rows[0].n).toBe(1);
    const n = await admin((q) => q("select count(*)::int n from public.notification_events where chain_id = $1 and kind = 'your_turn' and recipient_id = $2", [chain_id, b]));
    expect(n.rows[0].n).toBe(1);
  });

  it("veralteter Stand (zweiter Tab) wird abgewiesen statt doppelt geschrieben", async () => {
    const a = await newUser();
    const b = await newUser();
    const { chain_id, invite_token } = await startChain(a);
    await join(b, invite_token);
    await add(a, chain_id, 3);
    await expectError(add(a, chain_id, 3), /not_your_turn|stale/);
  });

  it("gleicher Track zweimal in einer Kette wird abgewiesen (CHAIN-12)", async () => {
    const a = await newUser();
    const b = await newUser();
    const t = track(1);
    const { rows } = await as(a, (q) => q("select * from public.start_chain('x', $1, 't')", [t.url]));
    await expectError(
      as(b, (q) => q("select public.join_chain($1, $2, 't')", [rows[0].invite_token, t.url.replace("https://", "https://www.") + "?si=abc"])),
      /duplicate|unique/,
    );
  });
});

describe("6 · Abschluss nach Track 6 (B13, CHAIN-09)", () => {
  it("nach sechs Tracks abgeschlossen, Track 7 wird abgewiesen", async () => {
    const { a, chain } = await fullChain();
    const { rows } = await admin((q) => q("select state, turn_account_id from public.chains where id = $1", [chain]));
    expect(rows[0].state).toBe("completed");
    expect(rows[0].turn_account_id).toBeNull();
    await expectError(add(a, chain, 7), /chain_not_active/);
  });
});

describe("7 · Widerrufene Einladung (B14, CHAIN-11)", () => {
  it("widerrufener Link geht nicht mehr, neuer Link funktioniert", async () => {
    const a = await newUser();
    const b = await newUser();
    const { chain_id, invite_token } = await startChain(a);
    const { rows } = await as(a, (q) => q("select public.renew_invite($1) as t", [chain_id]));
    await expectError(join(b, invite_token), /invite_revoked/);
    await join(b, rows[0].t);
  });
});

describe("8 · Veröffentlichung nur mit beiden Freigaben (C15, C16, PUBLISH-01..03)", () => {
  it("erst öffentlich, wenn beide freigeben; Widerruf macht es wieder privat", async () => {
    const { a, b, chain } = await fullChain();
    const anonCount = async () =>
      (await as(null, (q) => q("select * from public.chain_entries where chain_id = $1", [chain]))).rowCount;

    expect(await anonCount()).toBe(0);
    await as(a, (q) => q("select public.set_chain_approval($1, true)", [chain]));
    expect(await anonCount()).toBe(0);
    await as(b, (q) => q("select public.set_chain_approval($1, true)", [chain]));
    expect(await anonCount()).toBe(6);
    await as(b, (q) => q("select public.set_chain_approval($1, false)", [chain]));
    expect(await anonCount()).toBe(0);
  });

  it("laufende Kette kann nicht freigegeben werden", async () => {
    const a = await newUser();
    const { chain_id } = await startChain(a);
    await expectError(as(a, (q) => q("select public.set_chain_approval($1, true)", [chain_id])), /chain_not_completed/);
  });
});

describe("9 · Blockieren (TRUST-06)", () => {
  it("Blockieren beendet die gemeinsame Runde und verhindert neue Beitritte", async () => {
    const a = await newUser();
    const b = await newUser();
    const { chain_id, invite_token } = await startChain(a);
    await join(b, invite_token);
    await as(a, (q) => q("select public.block_account($1)", [b]));
    const { rows } = await admin((q) => q("select state from public.chains where id = $1", [chain_id]));
    expect(rows[0].state).toBe("archived");
    await expectError(add(a, chain_id, 3), /chain_not_active/);

    const second = await startChain(a);
    await expectError(join(b, second.invite_token), /blocked/);
  });
});

describe("10 · Melden (TRUST-05) und Feedback", () => {
  it("Meldung: anlegen ja, fremde Meldungen lesen nein, Admin sieht alles", async () => {
    const r1 = await newUser();
    const r2 = await newUser();
    const adminId = await newUser();
    await admin((q) => q("update public.accounts set is_admin = true where id = $1", [adminId]));
    await as(r1, (q) =>
      q("insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'profile', gen_random_uuid(), 'spam')", [r1]),
    );
    expect((await as(r2, (q) => q("select * from public.reports where reporter_id = $1", [r1]))).rowCount).toBe(0);
    expect((await as(adminId, (q) => q("select * from public.reports where reporter_id = $1", [r1]))).rowCount).toBe(1);
    await expectError(
      as(r2, (q) => q("insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'profile', gen_random_uuid(), 'spam')", [r1])),
      /row-level security/,
    );
  });

  it("Feedback: auch ohne Login abschicken, aber nur der Admin kann es lesen", async () => {
    const marker = `fb-${randomUUID()}`;
    await as(null, (q) => q("select public.submit_feedback('/login', 'bug', $1, false)", [marker]));
    const someone = await newUser();
    expect((await as(someone, (q) => q("select * from public.feedback where message = $1", [marker]))).rowCount).toBe(0);
    expect((await as(null, (q) => q("select * from public.feedback where message = $1", [marker]))).rowCount).toBe(0);
    const adminId = await newUser();
    await admin((q) => q("update public.accounts set is_admin = true where id = $1", [adminId]));
    expect((await as(adminId, (q) => q("select * from public.feedback where message = $1", [marker]))).rowCount).toBe(1);
  });

  it("gesperrtes Konto kann keine Kette starten, Profil ist offline", async () => {
    const adminId = await newUser();
    await admin((q) => q("update public.accounts set is_admin = true where id = $1", [adminId]));
    const u = await newUser();
    const handle = `bad${Date.now()}`;
    await makeProfile(u, handle);
    await as(u, (q) => q("select public.publish_profile()"));
    await as(adminId, (q) => q("select public.admin_suspend($1, true)", [u]));
    expect((await as(null, (q) => q("select * from public.profiles where handle = $1", [handle]))).rowCount).toBe(0);
    await expectError(startChain(u), /suspended/);
  });
});
