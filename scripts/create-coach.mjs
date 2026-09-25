// Legt ein Coach-Konto an (oder setzt dessen Passwort neu).
// Aufruf: npm run coach:create -- olivia
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const name = (process.argv[2] || "").trim();
if (!/^[A-Za-z0-9_.]{3,24}$/.test(name)) {
  console.error("Bitte einen Namen angeben: npm run coach:create -- olivia");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt."); process.exit(1); }
const sql = postgres(url, { ssl: process.env.DATABASE_SSL === "require" ? "require" : false, max: 1 });

const password = process.env.COACH_PASSWORD || randomBytes(9).toString("base64url");
const hash = await bcrypt.hash(password, 12);
const existing = await sql`select id from users where role = 'coach' and pseudonym_lower = ${name.toLowerCase()}`;
if (existing.length) {
  await sql`update users set password_hash = ${hash}, disabled = false where id = ${existing[0].id}`;
  await sql`delete from sessions where user_id = ${existing[0].id}`;
  console.log(`Passwort für Coach "${name}" wurde neu gesetzt.`);
} else {
  await sql`insert into users (role, pseudonym, pseudonym_lower, password_hash) values ('coach', ${name}, ${name.toLowerCase()}, ${hash})`;
  console.log(`Coach "${name}" wurde angelegt.`);
}
if (!process.env.COACH_PASSWORD) console.log(`Passwort: ${password}\nBitte sicher notieren, es wird nicht noch einmal angezeigt.`);
await sql.end();
