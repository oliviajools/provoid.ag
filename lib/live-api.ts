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
    if (origin && new URL(origin).host !== new URL(req.url).host && origin !== process.env.APP_ORIGIN) {
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
