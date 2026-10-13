import { sql } from "@/lib/db";
import { activeFor, liveSlide, loadItem, loadItems, results } from "@/lib/live";
import { guard, json } from "@/lib/live-api";

export const dynamic = "force-dynamic";

/** Für die Tafel: aktuelle Interaktion mit Ergebnissen (ohne Namen). */
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId, true);
  if ("error" in g) return g.error;
  const url = new URL(req.url);
  const slideParam = url.searchParams.get("slide");
  const slide = slideParam ? Number(slideParam) : await liveSlide(sessionId);
  const stored = await liveSlide(sessionId);
  const [{ online }] = await sql<{ online: number }[]>`
    select count(*)::int as online from live_presence where group_id = ${g.session.group_id} and seen_at > now() - interval '30 seconds'`;
  const items = await loadItems(sessionId);
  const forced = url.searchParams.get("item");
  const a = forced ? (await loadItem(forced).then((i) => (i && i.session_id === sessionId ? { item: i, mode: "open" as const } : null))) : activeFor(items, slide);
  if (!a) return json({ slide, stored, online, items: items.length, published: g.session.published, active: null });
  const { item, mode } = a;
  return json({
    slide, stored, online, items: items.length, published: g.session.published,
    active: { id: item.id, title: item.title, kind: item.kind, rows: item.rows, options: item.options, solution: item.solution, mode, private: item.private, homework: item.homework },
    result: await results(item, true),
  });
}
