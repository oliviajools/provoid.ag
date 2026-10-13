import { activeFor, liveSlide, loadItems, myAnswers, results } from "@/lib/live";
import { guard, json, touchPresence } from "@/lib/live-api";

export const dynamic = "force-dynamic";

/** Für die Geräte der Teilnehmenden: Was ist gerade dran? */
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const g = await guard(req, sessionId);
  if ("error" in g) return g.error;
  await touchPresence(g.user);
  const slide = await liveSlide(sessionId);
  if (slide === null) return json({ live: false });
  const items = await loadItems(sessionId);
  const a = activeFor(items, slide);
  if (!a) return json({ live: true, slide, active: null });
  const { item, mode } = a;
  const mine = await myAnswers(item.id, g.user.id);
  const showResult = mode === "reveal" && !item.private;
  return json({
    live: true, slide,
    active: {
      id: item.id, title: item.title, kind: item.kind, rows: item.rows, options: item.options, mode,
      homework: item.homework, private: item.private,
      solution: mode === "reveal" ? item.solution : null,
      mine,
      result: showResult ? await results(item) : null,
    },
  });
}
