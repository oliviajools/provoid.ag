import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { INLINE_MIME, canView } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("Bitte einloggen.", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Nicht gefunden.", { status: 404 });
  const m = (await sql<{ filename: string; mime: string; size: number; group_id: string; published: boolean; complete: boolean }[]>`
    select m.filename, m.mime, m.size::int as size, m.complete, s.group_id, s.published
    from materials m join ag_sessions s on s.id = m.session_id
    where m.id = ${id} and m.kind = 'file'`)[0];
  if (!m || !m.complete || !canView(user, m)) return new Response("Nicht gefunden.", { status: 404 });

  const { rows } = { rows: await sql<{ idx: number }[]>`select idx from material_chunks where material_id = ${id} order by idx` };
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= rows.length) return controller.close();
      const [c] = await sql<{ data: Buffer }[]>`select data from material_chunks where material_id = ${id} and idx = ${rows[i].idx}`;
      i++;
      controller.enqueue(new Uint8Array(c.data));
    },
  });
  const download = new URL(req.url).searchParams.has("download") || !INLINE_MIME.has(m.mime);
  const ascii = m.filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(stream, {
    headers: {
      "content-type": m.mime,
      "content-length": String(m.size),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(m.filename)}`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
