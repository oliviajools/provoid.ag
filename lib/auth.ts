import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql } from "./db";

export const SESSION_COOKIE = "ag_session";
const SESSION_DAYS = 30;

export type User = {
  id: string;
  role: "student" | "coach";
  pseudonym: string;
  group_id: string | null;
  group_name: string | null;
  group_school: string | null;
  group_starts_label: string | null;
  days_until_start: number | null;
  must_change_password: boolean;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await sql`insert into sessions (token_hash, user_id, expires_at) values (${sha256(token)}, ${userId}, ${expires})`;
  await sql`update users set last_login_at = now() where id = ${userId}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<User[]>`
    select u.id, u.role, u.pseudonym, u.group_id, u.must_change_password,
           g.name as group_name, g.school as group_school, to_char(g.starts_on, 'DD.MM.YYYY') as group_starts_label,
           (g.starts_on - (now() at time zone 'Europe/Berlin')::date)::int as days_until_start
    from sessions s
    join users u on u.id = s.user_id
    left join groups g on g.id = u.group_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and u.disabled = false`;
  return rows[0] ?? null;
}

/** Für Seiten, die nur eingeloggte Personen sehen dürfen. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getUser();
  if (!user) redirect("/");
  if (user.must_change_password && !opts.allowPasswordChange) redirect("/passwort");
  return user;
}

export async function requireCoach() {
  const user = await getUser();
  if (!user || user.role !== "coach") redirect("/coach/login");
  if (user.must_change_password) redirect("/passwort");
  return user;
}

// Schutz gegen Durchprobieren von Passwörtern: max. 8 Fehlversuche in 15 Minuten.
const WINDOW_MIN = 15;
const MAX_FAILS = 8;

export async function isLockedOut(key: string) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from login_attempts
    where key = ${key} and attempted_at > now() - make_interval(mins => ${WINDOW_MIN})`;
  return n >= MAX_FAILS;
}
export async function recordFailure(key: string) {
  await sql`insert into login_attempts (key) values (${key})`;
  // Aufräumen: alte Einträge löschen
  await sql`delete from login_attempts where attempted_at < now() - interval '1 day'`;
}
export async function clearFailures(key: string) {
  await sql`delete from login_attempts where key = ${key}`;
}
