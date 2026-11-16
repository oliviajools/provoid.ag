import "server-only";
import { sql } from "./db";
import type { AttStatus } from "./attendance";
import type { Phase } from "./sessions";

export type DocSession = {
  id: string; number: number; title: string; date_label: string | null; date_iso: string | null; phase: Phase | null;
  summary: string; protocol: string; held: boolean;
};
export type DocItem = { session_id: string; title: string; people: number };
export type DocGuest = { session_id: string; name: string; role: string };
export type DocMember = { id: string; pseudonym: string; disabled: boolean };
export type DocAtt = { session_id: string; user_id: string; status: AttStatus };

/** Alles, was für die Dokumentation einer AG gebraucht wird. „held“: Datum erreicht oder schon Anwesenheit eingetragen. */
export async function loadDocumentation(groupId: string) {
  const sessions = await sql<DocSession[]>`
    select s.id, s.number, s.title, s.phase, s.summary, s.protocol,
           to_char(s.date, 'Dy DD.MM.YYYY') as date_label, to_char(s.date, 'YYYY-MM-DD') as date_iso,
           (s.date <= (now() at time zone 'Europe/Berlin')::date
             or exists (select 1 from attendance a where a.session_id = s.id)) as held
    from ag_sessions s where s.group_id = ${groupId} order by s.number, s.date`;
  const ids = sessions.map((s) => s.id);
  const items = ids.length ? await sql<DocItem[]>`
    select i.session_id, i.title, count(distinct r.user_id)::int as people
    from live_items i left join live_responses r on r.item_id = i.id
    where i.session_id in ${sql(ids)}
    group by i.id, i.session_id, i.title, i.position, i.created_at
    having count(r.id) > 0
    order by i.position, i.created_at` : [];
  const guests = ids.length ? await sql<DocGuest[]>`
    select session_id, name, role from guests where session_id in ${sql(ids)} order by date nulls last` : [];
  const members = await sql<DocMember[]>`
    select id, pseudonym, disabled from users where group_id = ${groupId} and role = 'student' order by pseudonym_lower`;
  const att = ids.length ? await sql<DocAtt[]>`
    select session_id, user_id, status from attendance where session_id in ${sql(ids)}` : [];
  return { sessions, items, guests, members, att };
}
