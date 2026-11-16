import "server-only";
import { sql } from "./db";

export type AttStatus = "present" | "excused" | "absent";
export const ATT_LABEL: Record<AttStatus, string> = { present: "da", excused: "entschuldigt", absent: "fehlt" };

/** Ein Gerät ist während der Live-Sitzung verbunden: als anwesend vermerken (überschreibt nie einen Eintrag der Coach). */
export async function markPresentAuto(sessionId: string, userId: string) {
  await sql`
    insert into attendance (session_id, user_id, status, source)
    values (${sessionId}, ${userId}, 'present', 'auto')
    on conflict (session_id, user_id) do nothing`.catch(() => {});
}

export type AttRow = { user_id: string; pseudonym: string; disabled: boolean; status: AttStatus | null; source: "auto" | "manual" | null };

/** Alle Mitglieder der AG mit ihrem Status für diese Sitzung. */
export async function attendanceFor(sessionId: string, groupId: string) {
  return sql<AttRow[]>`
    select u.id as user_id, u.pseudonym, u.disabled, a.status, a.source
    from users u
    left join attendance a on a.user_id = u.id and a.session_id = ${sessionId}
    where u.group_id = ${groupId} and u.role = 'student'
    order by u.pseudonym_lower`;
}
