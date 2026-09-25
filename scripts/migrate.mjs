// Legt die Tabellen an bzw. aktualisiert sie. Aufruf: npm run db:migrate
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt."); process.exit(1); }
const sql = postgres(url, { ssl: process.env.DATABASE_SSL === "require" ? "require" : false, max: 1, onnotice: () => {} });
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await sql.unsafe(schema);
console.log("Datenbank ist auf dem aktuellen Stand.");
await sql.end();
