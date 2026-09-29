import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ALLOWED_MIME, CHUNK_BYTES, MAX_FILE_BYTES } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

// Datei-Upload in Stücken (Vercel erlaubt pro Anfrage nur ca. 4,5 MB):
// 1. ?step=init  (JSON)       -> legt das Material an, gibt die id zurück
// 2. ?step=chunk&id=…&idx=…  -> ein Stück (max. 3 MB) als Rohdaten
// 3. ?step=done&id=…         -> prüft die Größe und schaltet die Datei frei
export async function POST(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "coach") return err("Nur für Coaches.", 403);
  const url = new URL(req.url);
  const step = url.searchParams.get("step");

  if (step === "init") {
    const b = (await req.json()) as { sessionId?: string; filename?: string; mime?: string; size?: number; title?: string };
    const mime = String(b.mime ?? "");
    const size = Number(b.size ?? 0);
    const filename = String(b.filename ?? "datei").slice(0, 200);
    if (!ALLOWED_MIME[mime]) return err(`Dieser Dateityp wird nicht unterstützt (${mime || "unbekannt"}). Erlaubt sind PDF, Office-Dateien, Bilder, Audio und Video.`);
    if (!(size > 0) || size > MAX_FILE_BYTES) return err("Die Datei ist zu groß. Erlaubt sind bis zu 50 MB.");
    const s = await sql`select 1 from ag_sessions where id = ${String(b.sessionId)}`;
    if (!s.length) return err("Sitzung nicht gefunden.", 404);
    const title = String(b.title || filename.replace(/\.[^.]+$/, "")).slice(0, 200);
    const [row] = await sql<{ id: string }[]>`
      insert into materials (session_id, kind, title, filename, mime, size, complete, position)
      values (${String(b.sessionId)}, 'file', ${title}, ${filename}, ${mime}, ${size}, false,
              (select coalesce(max(position), 0) + 1 from materials where session_id = ${String(b.sessionId)}))
      returning id`;
    return NextResponse.json({ id: row.id, chunkBytes: CHUNK_BYTES });
  }

  const id = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return err("Ungültige Anfrage.");
  const m = (await sql<{ size: number; complete: boolean }[]>`select size::int as size, complete from materials where id = ${id} and kind = 'file'`)[0];
  if (!m) return err("Material nicht gefunden.", 404);

  if (step === "chunk") {
    if (m.complete) return err("Upload ist schon abgeschlossen.");
    const idx = Number(url.searchParams.get("idx"));
    const data = Buffer.from(await req.arrayBuffer());
    if (!Number.isInteger(idx) || idx < 0 || data.length === 0 || data.length > CHUNK_BYTES) return err("Ungültiges Dateistück.");
    await sql`insert into material_chunks (material_id, idx, data) values (${id}, ${idx}, ${data})
              on conflict (material_id, idx) do update set data = excluded.data`;
    return NextResponse.json({ ok: true });
  }

  if (step === "done") {
    const [{ total }] = await sql<{ total: number }[]>`select coalesce(sum(length(data)), 0)::bigint::int as total from material_chunks where material_id = ${id}`;
    if (total !== m.size) {
      return err(`Die Datei ist unvollständig angekommen (${total} von ${m.size} Bytes). Bitte nochmal hochladen.`);
    }
    await sql`update materials set complete = true where id = ${id}`;
    return NextResponse.json({ ok: true });
  }

  if (step === "abort") {
    await sql`delete from materials where id = ${id} and complete = false`;
    return NextResponse.json({ ok: true });
  }
  return err("Unbekannter Schritt.");
}
