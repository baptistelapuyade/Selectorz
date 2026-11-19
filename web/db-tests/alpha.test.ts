import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, expectError, newUser, pool, track } from "./db";

afterAll(() => pool.end());

const feedback = (user: string | null, rateKey: string, msg = "Preview stayed empty") =>
  as(user, (q) => q("select public.submit_feedback('/login', 'bug', $1, false, 'test-agent', $2) as id", [msg, rateKey]));

describe("Feedback (Alpha)", () => {
  it("ohne Login möglich; landet mit Seite und Art in der Datenbank", async () => {
    const marker = `fb-${randomUUID()}`;
    await feedback(null, `k-${randomUUID()}`, marker);
    const { rows } = await admin((q) => q("select page, kind, account_id from public.feedback where message = $1", [marker]));
    expect(rows).toEqual([{ page: "/login", kind: "bug", account_id: null }]);
  });

  it("mit Login wird das Konto mitgespeichert", async () => {
    const u = await newUser();
    const marker = `fb-${randomUUID()}`;
    await feedback(u, `k-${randomUUID()}`, marker);
    const { rows } = await admin((q) => q("select account_id from public.feedback where message = $1", [marker]));
    expect(rows[0].account_id).toBe(u);
  });

  it("leerer Text wird abgewiesen", async () => {
    await expectError(feedback(null, `k-${randomUUID()}`, "   "), /check/);
  });

  it("mehr als 5 Feedbacks in 10 Minuten vom selben Browser werden abgewiesen", async () => {
    const key = `k-${randomUUID()}`;
    for (let i = 0; i < 5; i++) await feedback(null, key);
    await expectError(feedback(null, key), /rate_limited/);
    await feedback(null, `k-${randomUUID()}`); // anderer Browser geht weiter
  });

  it("direktes Einfügen an der Funktion vorbei geht nicht mehr", async () => {
    await expectError(
      as(null, (q) => q("insert into public.feedback (page, kind, message) values ('/', 'idea', 'x')")),
      /row-level security|permission denied/,
    );
  });
});

describe("Einstellungen", () => {
  it("Mail-Benachrichtigungen lassen sich abschalten", async () => {
    const u = await newUser();
    await as(u, (q) => q("update public.accounts set notify_email = false where id = $1", [u]));
    const { rows } = await admin((q) => q("select notify_email from public.accounts where id = $1", [u]));
    expect(rows[0].notify_email).toBe(false);
  });

  it("Blockierte erscheinen mit Namen und lassen sich entblocken", async () => {
    const me = await newUser("Luma");
    const other = await newUser("Marlon");
    await as(me, (q) => q("select public.block_account($1)", [other]));
    const list = await as(me, (q) => q("select * from public.my_blocks()"));
    expect(list.rows.map((r) => r.display_name)).toEqual(["Marlon"]);
    await as(me, (q) => q("delete from public.blocks where blocked_id = $1", [other]));
    expect((await as(me, (q) => q("select * from public.my_blocks()"))).rowCount).toBe(0);
  });
});

describe("Konto löschen (PRD 11.4)", () => {
  it("Profil weg, Freigaben weg, Kette der anderen Person bleibt heil", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const t1 = track(1);
    const start = await as(a, (q) => q("select * from public.start_chain('Slow Sunday', $1, $2)", [t1.url, t1.title]));
    const chain = start.rows[0].chain_id as string;
    const t2 = track(2);
    await as(b, (q) => q("select public.join_chain($1, $2, $3)", [start.rows[0].invite_token, t2.url, t2.title]));
    await as(a, async (q) => {
      const { rows } = await q("insert into public.profiles (account_id, handle) values ($1, $2) returning id", [a, `del${Date.now()}`]);
      return rows[0].id;
    });

    await as(a, (q) => q("select public.prepare_account_deletion()"));
    await admin((q) => q("delete from auth.users where id = $1", [a]));

    const ch = await admin((q) => q("select state, creator_id from public.chains where id = $1", [chain]));
    expect(ch.rows[0]).toEqual({ state: "archived", creator_id: null });
    const entries = await as(b, (q) => q("select position, author_id from public.chain_entries where chain_id = $1 order by position", [chain]));
    expect(entries.rows).toEqual([
      { position: 1, author_id: null },
      { position: 2, author_id: b },
    ]);
    const prof = await admin((q) => q("select count(*)::int n from public.profiles where account_id = $1", [a]));
    expect(prof.rows[0].n).toBe(0);
    await expectError(
      as(b, (q) => q("select public.add_track($1, 3, 'https://x.y/3', 'Three')", [chain])),
      /chain_not_active/,
    );
  });
});
