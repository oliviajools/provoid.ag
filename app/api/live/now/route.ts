import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { LIVE_HOURS, activeFor, loadItems } from "@/lib/live";
import { json, touchPresence } from "@/lib/live-api";

export const dynamic = "force-dynamic";

/** Läuft für meine Gruppe gerade eine Sitzung live, und welche Aufgabe ist dran? */
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "student" || !user.group_id) return json({ live: null });
  await touchPresence(user);
  const [s] = await sql<{ id: string; number: number; live_slide: number }[]>`
    select id, number, live_slide from ag_sessions
    where group_id = ${user.group_id} and published and live_slide is not null
      and live_at > now() - make_interval(hours => ${LIVE_HOURS})
    order by live_at desc limit 1`;
  if (!s) return json({ live: null });
  const a = activeFor(await loadItems(s.id), s.live_slide);
  return json({ live: { sessionId: s.id, number: s.number, itemId: a?.item.id ?? null, title: a?.item.title ?? null, mode: a?.mode ?? null } });
}
