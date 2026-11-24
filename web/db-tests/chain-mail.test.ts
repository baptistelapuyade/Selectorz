import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { admin, as, expectError, newUser, pool, track } from "./db";

// M2 Teil 2b: Ketten-Mails (Plan vom 24.11.2026; PRD 22 Nr. 12, 18, 19; NOTIFY-01..06, -08).
afterAll(() => pool.end());

type Ev = { id: string; kind: string; to: string; chain: { id: string; count: number }; other: { name: string }; last: { title: string; mine: boolean } };

async function start(a: string) {
  const t = track(1);
  const { rows } = await as(a, (q) => q("select * from public.start_chain('Slow Sunday', $1, $2, $3, '', $4)", [t.url, t.title, t.artist, randomUUID()]));
  return rows[0] as { chain_id: string; invite_token: string };
}
const join = (b: string, token: string, req = randomUUID()) => {
  const t = track(2);
  return as(b, (q) => q("select public.join_chain($1, $2, $3, $4, 'Answer.', $5)", [token, t.url, t.title, t.artist, req]));
};
const add = (u: string, c: string, pos: number, req = randomUUID()) => {
  const t = track(pos);
  return as(u, (q) => q("select * from public.add_track($1, $2, $3, $4, $5, '', $6)", [c, pos, t.url, t.title, t.artist, req]));
};
// Alles Offene abholen (auch aus anderen Tests) und nur die eigene Kette betrachten
const claim = (chain: string) => admin((q) => q("select public.claim_notifications(10000) as e")).then((r) => (r.rows[0].e as Ev[]).filter((e) => e.chain.id === chain));
const status = (chain: string) =>
  admin((q) => q("select kind, recipient_id, status from public.notification_events where chain_id = $1 order by created_at", [chain])).then((r) => r.rows);

describe("Ketten-Mails", () => {
  it("M1: genau ein Ereignis pro Zug, auch bei doppelter Anfrage; Inhalt für die Mail aus dem Konto", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const { chain_id, invite_token } = await start(a);
    const req = randomUUID();
    await join(b, invite_token, req);
    await join(b, invite_token, req).catch(() => {});
    const ev = await claim(chain_id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: "your_turn", to: `${a}@example.com`, chain: { count: 2 }, other: { name: "Kofi" }, last: { title: "Track 2", mine: false } });
    // Abgeholte Ereignisse werden kein zweites Mal geliefert
    expect(await claim(chain_id)).toHaveLength(0);
    await admin((q) => q("select public.finish_notification($1, true)", [ev[0].id]));
    expect((await status(chain_id)).map((r) => r.status)).toEqual(["sent"]);
  });

  it("M2: Abschluss: eine Mail je Person statt der letzten Zug-Mail", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const { chain_id, invite_token } = await start(a);
    await join(b, invite_token);
    for (let p = 3; p <= 6; p++) await add(p % 2 ? a : b, chain_id, p);
    const kinds = (await status(chain_id)).map((r) => `${r.kind}:${r.recipient_id === a ? "A" : "B"}`);
    expect(kinds.filter((k) => k.startsWith("completed")).sort()).toEqual(["completed:A", "completed:B"]);
    expect(kinds.filter((k) => k.startsWith("your_turn"))).toHaveLength(4); // Züge 2..5
  });

  it("M3: Erinnerung nach drei Tagen genau einmal; veraltet, abgeschaltet oder beendet wird übersprungen", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const { chain_id, invite_token } = await start(a);
    await join(b, invite_token);
    await claim(chain_id);
    // Zug liegt vier Tage zurück
    await admin((q) => q("update public.chain_entries set created_at = now() - interval '4 days' where chain_id = $1", [chain_id]));
    await admin((q) => q("select public.queue_reminders()"));
    await admin((q) => q("select public.queue_reminders()"));
    const r = (await status(chain_id)).filter((x) => x.kind === "reminder");
    expect(r).toHaveLength(1);
    expect(r[0].recipient_id).toBe(a);
    // A spielt vorher: Erinnerung ist veraltet und wird übersprungen
    await add(a, chain_id, 3);
    const ev = await claim(chain_id);
    expect(ev.map((e) => e.kind)).toEqual(["your_turn"]);
    expect((await status(chain_id)).find((x) => x.kind === "reminder")!.status).toBe("skipped");

    // Abgeschaltet: nichts mehr
    await as(a, (q) => q("update public.accounts set notify_email = false where id = $1", [a]));
    await add(b, chain_id, 4);
    expect(await claim(chain_id)).toHaveLength(0);
    // Beendet: keine Erinnerung mehr
    await as(a, (q) => q("select public.end_chain($1)", [chain_id]));
    await admin((q) => q("update public.chain_entries set created_at = now() - interval '9 days' where chain_id = $1", [chain_id]));
    await admin((q) => q("select public.queue_reminders()"));
    expect((await status(chain_id)).filter((x) => x.kind === "reminder")).toHaveLength(1);
  });

  it("M4: Fehlschlag gibt das Ereignis frei, nach drei Versuchen endgültig failed; Zug bleibt gespeichert", async () => {
    const a = await newUser("Luma");
    const b = await newUser("Kofi");
    const { chain_id, invite_token } = await start(a);
    await join(b, invite_token);
    for (let i = 1; i <= 3; i++) {
      const ev = await claim(chain_id);
      expect(ev).toHaveLength(1);
      await admin((q) => q("select public.finish_notification($1, false)", [ev[0].id]));
    }
    expect((await status(chain_id))[0].status).toBe("failed");
    const n = await admin((q) => q("select count(*)::int as n from public.chain_entries where chain_id = $1", [chain_id]));
    expect(n.rows[0].n).toBe(2);
  });

  it("M5: nur der Server darf abholen", async () => {
    const a = await newUser("Luma");
    await expectError(as(a, (q) => q("select public.claim_notifications(5)")), /permission denied/);
    await expectError(as(null, (q) => q("select public.queue_reminders()")), /permission denied/);
  });
});
