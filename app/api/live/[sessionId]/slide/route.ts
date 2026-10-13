import { z } from "zod";
import { sql } from "@/lib/db";
import { guard, json } from "@/lib/live-api";

export const dynamic = "force-dynamic";

/** Die Präsentation meldet die aktuelle Folie (oder beendet den Live-Modus mit null). */
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId, true);
  if ("error" in g) return g.error;
  const p = z.object({ slide: z.number().int().min(1).max(500).nullable() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: "Ungültige Anfrage." }, 400);
  await sql`update ag_sessions set live_slide = ${p.data.slide}, live_at = ${p.data.slide === null ? null : sql`now()`} where id = ${sessionId}`;
  return json({ ok: true });
}
