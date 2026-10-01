import "server-only";
import { sql } from "./db";

export type Guest = {
  id: string; group_id: string; name: string; role: string; topic: string; bio: string; link: string;
  date_iso: string | null; day: string | null; month: string | null; weekday: string | null; time_label: string;
  session_id: string | null; session_number: number | null; session_title: string | null; session_published: boolean | null;
  questions_open: boolean; published: boolean; upcoming: boolean; questions: number;
};

const MONTHS = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];
const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export async function loadGuests(opts: { groupId: string; onlyPublished: boolean; id?: string }) {
  const rows = await sql<(Omit<Guest, "month" | "weekday"> & { m: number | null; dow: number | null })[]>`
    select g.id, g.group_id, g.name, g.role, g.topic, g.bio, g.link, g.time_label, g.session_id, g.questions_open, g.published,
           to_char(g.date, 'YYYY-MM-DD') as date_iso, to_char(g.date, 'DD') as day,
           extract(month from g.date)::int as m, extract(dow from g.date)::int as dow,
           (g.date is null or g.date >= (now() at time zone 'Europe/Berlin')::date) as upcoming,
           s.number as session_number, s.title as session_title, s.published as session_published,
           (select count(*)::int from guest_questions q where q.guest_id = g.id) as questions
    from guests g left join ag_sessions s on s.id = g.session_id
    where g.group_id = ${opts.groupId}
      ${opts.onlyPublished ? sql`and g.published` : sql``}
      ${opts.id ? sql`and g.id = ${opts.id}` : sql``}
    order by (g.date is null), g.date, g.created_at`;
  return rows.map(({ m, dow, ...g }) => ({ ...g, month: m ? MONTHS[m - 1] : null, weekday: dow != null ? DAYS[dow] : null }));
}

export async function nextGuest(groupId: string | null) {
  if (!groupId) return null;
  const list = await loadGuests({ groupId, onlyPublished: true });
  return list.find((g) => g.upcoming && g.date_iso) ?? null;
}
