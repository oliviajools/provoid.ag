import "server-only";
import { getUser, type User } from "./auth";
import { canView, loadSession, type SessionRow } from "./sessions";

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Prüft Login, Sitzungszugriff und (bei POST) die Herkunft der Anfrage. */
export async function guard(req: Request, sessionId: string, coachOnly = false):
  Promise<{ user: User; session: SessionRow } | { error: Response }> {
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    let originHost = "";
    try { originHost = origin ? new URL(origin).host : ""; } catch { originHost = "?"; }
    if (origin && originHost !== host && origin !== process.env.APP_ORIGIN) {
      return { error: json({ error: "Nicht erlaubt." }, 403) };
    }
  }
  const user = await getUser();
  if (!user) return { error: json({ error: "Bitte einloggen." }, 401) };
  if (coachOnly && user.role !== "coach") return { error: json({ error: "Nicht erlaubt." }, 403) };
  const session = await loadSession(sessionId);
  if (!session || !canView(user, session)) return { error: json({ error: "Nicht gefunden." }, 404) };
  return { user, session };
}

/** Merkt sich, dass ein Gerät der Gruppe gerade verbunden ist (höchstens alle 10 Sekunden ein Schreibzugriff). */
export async function touchPresence(user: User) {
  if (user.role !== "student" || !user.group_id) return;
  const { sql } = await import("./db");
  await sql`
    insert into live_presence (user_id, group_id, seen_at) values (${user.id}, ${user.group_id}, now())
    on conflict (user_id) do update set seen_at = now(), group_id = excluded.group_id
    where live_presence.seen_at < now() - interval '10 seconds'`.catch(() => {});
}
