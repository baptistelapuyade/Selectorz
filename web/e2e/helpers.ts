import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { latestCode } from "./mailpit";

export const fresh = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

export const db = new pg.Pool({
  connectionString: process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  max: 2,
  allowExitOnIdle: true, // von mehreren Testdateien geteilt; nicht einzeln schließen
});

export async function login(page: Page, email: string, next = "/home") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  const sentAt = Date.now();
  await page.getByRole("button", { name: /send me a code/i }).click();
  await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
  await page.getByLabel("6-digit code").fill(await latestCode(email, sentAt));
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/]/g, "\\/")}$`));
}

export async function userId(email: string): Promise<string> {
  const { rows } = await db.query("select id from auth.users where email = $1", [email]);
  return rows[0]?.id;
}

// Eingeloggt mit veröffentlichter Seite (direkt über die Datenbank angelegt)
export async function liveProfile(page: Page, name = "Luma Reyes") {
  return (await liveProfileUser(page, name)).handle;
}

export async function liveProfileUser(page: Page, name = "Luma Reyes") {
  const email = fresh("edit");
  await login(page, email);
  const uid = await userId(email);
  const handle = `e2e${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const c = await db.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    await c.query("select public.create_and_publish_profile($1, $2, '{House}', '{Vinyl}', 'Berlin', 'day', $3, $4)", [
      handle,
      name,
      `${uid}/avatar.png`,
      JSON.stringify({ kind: "mix", title: "My sound", content: { mixes: [{ url: "https://soundcloud.com/luma/late-hours-mix", title: "Late Hours Mix", provider: "soundcloud" }] } }),
    ]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  return { handle, uid };
}

// SQL als eingeloggte Person (wie über die API: Rolle authenticated, auth.uid() = uid)
export async function asUser<T>(uid: string, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const r = await fn((sql, params) => c.query(sql, params));
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

// Fertige Kette mit sechs Tracks, direkt über die Datenbank-Funktionen (A beginnt, B tritt bei)
export async function completedChain(a: string, b: string, title = "Slow Sunday") {
  const t = (n: number) => [`https://soundcloud.com/e2e/track-${n}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, ["Ostkreuz Dub", "Glass Floor", "Low Ceiling", "Harbour Lights", "Warm Concrete", "Basement Weather"][n - 1], "Halden"];
  const { chain_id, invite_token } = await asUser(a, (q) => q("select * from public.start_chain($1, $2, $3, $4, 'To get us started.', gen_random_uuid())", [title, ...t(1)])).then((r) => r.rows[0]);
  await asUser(b, (q) => q("select public.join_chain($1, $2, $3, $4, '', gen_random_uuid())", [invite_token, ...t(2)]));
  for (let n = 3; n <= 6; n++) await asUser(n % 2 ? a : b, (q) => q("select * from public.add_track($1, $2, $3, $4, $5, '', gen_random_uuid())", [chain_id, n, ...t(n)]));
  return chain_id as string;
}
