"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canView, loadSession } from "@/lib/sessions";

export async function saveNote(sessionId: string, body: string): Promise<{ ok: boolean; at?: string; error?: string }> {
  const user = await requireUser();
  if (user.role !== "student") return { ok: false, error: "Notizen sind für Teilnehmende." };
  const s = await loadSession(sessionId);
  if (!s || !canView(user, s)) return { ok: false, error: "Sitzung nicht gefunden." };
  const text = String(body).slice(0, 30000);
  await sql`
    insert into notes (user_id, session_id, body) values (${user.id}, ${sessionId}, ${text})
    on conflict (user_id, session_id) do update set body = excluded.body, updated_at = now()`;
  return { ok: true, at: new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date()) };
}
