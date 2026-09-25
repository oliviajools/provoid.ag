import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt. Siehe .env.example.");
  return postgres(url, {
    ssl: process.env.DATABASE_SSL === "require" ? "require" : false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Eine Verbindung pro Serverprozess, auch bei Hot Reload in der Entwicklung.
export const sql = globalThis.__sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
