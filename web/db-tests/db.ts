import { randomUUID } from "node:crypto";
import pg from "pg";

// Datenbank-Tests: echte Postgres-Verbindung (lokales Supabase in CI).
// Personen werden simuliert wie bei Supabase: Rolle 'authenticated' bzw. 'anon' plus Nutzer-ID im JWT-Claim.
export const pool = new pg.Pool({
  connectionString: process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  max: 10,
});

export type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;

export async function as<T>(user: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${user ? "authenticated" : "anon"}`);
    if (user) {
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
    }
    const out = await fn((sql, params) => c.query(sql, params));
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

export async function admin<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    return await fn((sql, params) => c.query(sql, params));
  } finally {
    c.release();
  }
}

export async function newUser(name = "DJ"): Promise<string> {
  const id = randomUUID();
  await admin((q) => q("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@example.com`]));
  await admin((q) => q("update public.accounts set display_name = $2 where id = $1", [id, name]));
  return id;
}

export async function expectError(p: Promise<unknown>, match: RegExp) {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (!match.test(msg)) throw new Error(`Falscher Fehler: ${msg} (erwartet ${match})`);
    return;
  }
  throw new Error(`Kein Fehler, erwartet ${match}`);
}

export const track = (n: number) => ({
  url: `https://soundcloud.com/artist-${n}/track-${n}-${randomUUID().slice(0, 6)}`,
  title: `Track ${n}`,
  artist: `Artist ${n}`,
});
