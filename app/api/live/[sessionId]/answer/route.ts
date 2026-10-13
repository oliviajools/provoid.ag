import { z } from "zod";
import { sql } from "@/lib/db";
import { MAX_WALL_PER_USER, canAnswer, loadItem } from "@/lib/live";
import { guard, json } from "@/lib/live-api";

export const dynamic = "force-dynamic";

const body = z.object({
  itemId: z.string().uuid(),
  key: z.string().max(60).optional(),
  value: z.string().max(2000).optional(),
  remove: z.string().max(60).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId);
  if ("error" in g) return g.error;
  if (g.user.role !== "student") return json({ error: "Nur Teilnehmende können antworten." }, 403);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: "Ungültige Anfrage." }, 400);
  const item = await loadItem(p.data.itemId);
  if (!item || item.session_id !== sessionId) return json({ error: "Nicht gefunden." }, 404);
  if (!(await canAnswer(item))) return json({ error: "Diese Aufgabe ist gerade nicht offen." }, 409);
  const uid = g.user.id;

  if (p.data.remove) {
    if (item.kind !== "wall") return json({ error: "Ungültige Anfrage." }, 400);
    await sql`delete from live_responses where item_id = ${item.id} and user_id = ${uid} and key = ${p.data.remove}`;
    return json({ ok: true });
  }

  const value = (p.data.value ?? "").trim();
  if (item.kind === "grid") {
    const row = Number(p.data.key), opt = Number(value);
    if (!Number.isInteger(row) || row < 0 || row >= item.rows.length || !Number.isInteger(opt) || opt < 0 || opt >= item.options.length) {
      return json({ error: "Ungültige Antwort." }, 400);
    }
    await sql`
      insert into live_responses (item_id, user_id, key, value) values (${item.id}, ${uid}, ${String(row)}, ${String(opt)})
      on conflict (item_id, user_id, key) do update set value = excluded.value, created_at = now()`;
    return json({ ok: true });
  }

  if (item.kind === "wall") {
    const col = Number(p.data.key);
    if (!Number.isInteger(col) || col < 0 || col >= Math.max(1, item.rows.length)) return json({ error: "Ungültige Spalte." }, 400);
    if (value.length < 1 || value.length > 200) return json({ error: "Bitte 1 bis 200 Zeichen." }, 400);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from live_responses where item_id = ${item.id} and user_id = ${uid}`;
    if (n >= MAX_WALL_PER_USER) return json({ error: `Höchstens ${MAX_WALL_PER_USER} Zettel pro Person.` }, 409);
    const key = `${col}:${crypto.randomUUID().slice(0, 8)}`;
    await sql`insert into live_responses (item_id, user_id, key, value) values (${item.id}, ${uid}, ${key}, ${value})`;
    return json({ ok: true, key });
  }

  const idx = Number(p.data.key);
  if (!Number.isInteger(idx) || idx < 0 || idx >= item.rows.length) return json({ error: "Ungültige Frage." }, 400);
  if (value === "") {
    await sql`delete from live_responses where item_id = ${item.id} and user_id = ${uid} and key = ${String(idx)}`;
  } else {
    await sql`
      insert into live_responses (item_id, user_id, key, value) values (${item.id}, ${uid}, ${String(idx)}, ${value})
      on conflict (item_id, user_id, key) do update set value = excluded.value, created_at = now()`;
  }
  return json({ ok: true });
}
