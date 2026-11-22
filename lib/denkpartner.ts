import "server-only";
import { sql } from "./db";
import type { User } from "./auth";
import type { Felder } from "./denkpartner-prompt";

export const MAX_PRO_PERSON = 10;
export const COACH_LIMIT = 300;

export type DP = {
  id: string; user_id: string; group_id: string | null; name: string; fach: string; jahrgang: string;
  felder: Partial<Felder>; prompt: string; updated: string;
};

export async function meineDenkpartner(userId: string) {
  return sql<DP[]>`
    select id, user_id, group_id, name, fach, jahrgang, felder, prompt,
           to_char(updated_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as updated
    from denkpartner where user_id = ${userId} order by updated_at desc`;
}

export async function ladeDenkpartner(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [d] = await sql<DP[]>`
    select id, user_id, group_id, name, fach, jahrgang, felder, prompt,
           to_char(updated_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as updated
    from denkpartner where id = ${id}`;
  return d;
}

/** Eigene Denkpartner darf man bearbeiten und testen. Coaches dürfen alle ansehen und testen. */
export const darfSehen = (user: User, d: DP) => d.user_id === user.id || user.role === "coach";
export const darfBearbeiten = (user: User, d: DP) => d.user_id === user.id;

/** Einstellungen der eigenen AG. Coaches sind nicht an eine AG gebunden. */
export async function einstellungen(user: User): Promise<{ enabled: boolean; limit: number }> {
  if (user.role === "coach" || !user.group_id) return { enabled: true, limit: COACH_LIMIT };
  const [g] = await sql<{ dp_enabled: boolean; dp_limit: number }[]>`select dp_enabled, dp_limit from groups where id = ${user.group_id}`;
  return { enabled: g?.dp_enabled ?? false, limit: g?.dp_limit ?? 0 };
}

const woche = sql`(date_trunc('week', now() at time zone 'Europe/Berlin'))::date`;

export async function verbrauchtDieseWoche(userId: string) {
  const [r] = await sql<{ n: number }[]>`select n from denkpartner_usage where user_id = ${userId} and week_start = ${woche}`;
  return r?.n ?? 0;
}

/** Zählt eine Nachricht, aber nur, wenn das Limit noch nicht erreicht ist. Gibt die neue Zahl zurück oder null. */
export async function zaehle(userId: string, limit: number) {
  const rows = await sql<{ n: number }[]>`
    insert into denkpartner_usage (user_id, week_start, n) values (${userId}, ${woche}, 1)
    on conflict (user_id, week_start) do update set n = denkpartner_usage.n + 1
      where denkpartner_usage.n < ${limit}
    returning n`;
  return rows[0]?.n ?? null;
}
