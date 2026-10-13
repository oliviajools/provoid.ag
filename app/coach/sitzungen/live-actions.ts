"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { TEMPLATES, loadItem } from "@/lib/live";

export type LiveActState = { ok?: string; error?: string } | undefined;

function refresh(sessionId: string) {
  revalidatePath(`/coach/sitzungen/${sessionId}`);
  revalidatePath(`/sitzungen/${sessionId}`);
}

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const slideNum = z.union([z.literal(""), z.coerce.number().int().min(1).max(500)]).transform((v) => (v === "" ? null : v));

const itemSchema = z.object({
  session_id: z.string().uuid(),
  title: z.string().trim().min(2, "Bitte einen Titel angeben.").max(160),
  kind: z.enum(["grid", "wall", "text"]),
  slide: slideNum, until_slide: slideNum, reveal_slide: slideNum,
});

function parseItem(form: FormData) {
  const p = itemSchema.safeParse({
    session_id: form.get("session_id"), title: form.get("title"), kind: form.get("kind"),
    slide: String(form.get("slide") ?? "").trim(), until_slide: String(form.get("until_slide") ?? "").trim(),
    reveal_slide: String(form.get("reveal_slide") ?? "").trim(),
  });
  if (!p.success) return { error: p.error.issues[0].message.startsWith("Bitte") ? p.error.issues[0].message : "Bitte prüfe die Folien-Nummern." } as const;
  const d = p.data;
  const rows = lines(form.get("rows")).slice(0, 30).map((l) => l.slice(0, 300));
  const options = d.kind === "grid" ? lines(form.get("options")).slice(0, 8).map((l) => l.slice(0, 80)) : [];
  if (d.kind === "grid" && rows.length === 0) return { error: "Bitte mindestens eine Frage oder Aussage angeben." } as const;
  if (d.kind === "grid" && options.length < 2) return { error: "Bitte mindestens zwei Antwortmöglichkeiten angeben." } as const;
  if (d.kind === "text" && rows.length === 0) return { error: "Bitte mindestens eine Frage angeben." } as const;
  let solution: (number | null)[] | null = null;
  if (d.kind === "grid") {
    const sol = String(form.get("solution") ?? "").split(/\r?\n/).map((l) => l.trim());
    if (sol.some(Boolean)) {
      solution = rows.map((_, i) => {
        const t = (sol[i] ?? "").toLowerCase();
        const idx = options.findIndex((o) => o.toLowerCase() === t);
        return idx >= 0 ? idx : null;
      });
    }
  }
  if (d.until_slide !== null && d.slide !== null && d.until_slide < d.slide) return { error: "„Offen bis Folie“ muss nach der Startfolie liegen." } as const;
  return {
    data: {
      ...d, rows: d.kind === "wall" && rows.length === 0 ? ["Eure Ideen"] : rows, options, solution,
      private: form.get("private") === "on", homework: form.get("homework") === "on",
    },
  } as const;
}

export async function saveLiveItem(_: LiveActState, form: FormData): Promise<LiveActState> {
  await requireCoach();
  const p = parseItem(form);
  if ("error" in p) return { error: p.error };
  const d = p.data;
  const id = String(form.get("id") ?? "");
  if (id) {
    const item = await loadItem(id);
    if (!item || item.session_id !== d.session_id) return { error: "Nicht gefunden." };
    const shapeChanged = item.kind !== d.kind || JSON.stringify(item.rows) !== JSON.stringify(d.rows) || JSON.stringify(item.options) !== JSON.stringify(d.options);
    await sql`
      update live_items set title = ${d.title}, kind = ${d.kind}, slide = ${d.slide}, until_slide = ${d.until_slide}, reveal_slide = ${d.reveal_slide},
        rows = ${sql.json(d.rows)}, options = ${sql.json(d.options)}, solution = ${d.solution ? sql.json(d.solution) : null},
        private = ${d.private}, homework = ${d.homework}
      where id = ${id}`;
    if (shapeChanged && item.kind !== d.kind) await sql`delete from live_responses where item_id = ${id}`;
    refresh(d.session_id);
    return { ok: "Gespeichert." };
  }
  await sql`
    insert into live_items (session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework)
    values (${d.session_id}, (select coalesce(max(position), 0) + 1 from live_items where session_id = ${d.session_id}),
            ${d.title}, ${d.kind}, ${d.slide}, ${d.until_slide}, ${d.reveal_slide}, ${sql.json(d.rows)}, ${sql.json(d.options)},
            ${d.solution ? sql.json(d.solution) : null}, ${d.private}, ${d.homework})`;
  refresh(d.session_id);
  return { ok: "Interaktion angelegt." };
}

export async function liveItemOp(form: FormData) {
  await requireCoach();
  const item = await loadItem(String(form.get("id") ?? ""));
  if (!item) return;
  const op = String(form.get("op"));
  if (op === "delete") await sql`delete from live_items where id = ${item.id}`;
  if (op === "reset") await sql`delete from live_responses where item_id = ${item.id}`;
  if (op === "toggle") await sql`update live_items set closed = not closed where id = ${item.id}`;
  if (op === "open" && item.slide !== null) {
    await sql`update ag_sessions set live_slide = ${item.slide}, live_at = now() where id = ${item.session_id}`;
  }
  if (op === "reveal" && item.reveal_slide !== null) {
    await sql`update ag_sessions set live_slide = ${item.reveal_slide}, live_at = now() where id = ${item.session_id}`;
  }
  refresh(item.session_id);
}

export async function stopLive(form: FormData) {
  await requireCoach();
  const id = String(form.get("session_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await sql`update ag_sessions set live_slide = null, live_at = null where id = ${id}`;
  refresh(id);
}

export async function insertTemplate(_: LiveActState, form: FormData): Promise<LiveActState> {
  await requireCoach();
  const sessionId = String(form.get("session_id") ?? "");
  const t = TEMPLATES[String(form.get("template") ?? "")];
  if (!t || !/^[0-9a-f-]{36}$/i.test(sessionId)) return { error: "Bitte eine Vorlage wählen." };
  const [{ pos }] = await sql<{ pos: number }[]>`select coalesce(max(position), 0)::int as pos from live_items where session_id = ${sessionId}`;
  let i = pos;
  for (const it of t.items) {
    i++;
    await sql`
      insert into live_items (session_id, position, title, kind, slide, until_slide, reveal_slide, rows, options, solution, private, homework)
      values (${sessionId}, ${i}, ${it.title}, ${it.kind}, ${it.slide}, ${it.until_slide}, ${it.reveal_slide}, ${sql.json(it.rows)},
              ${sql.json(it.options)}, ${it.solution ? sql.json(it.solution) : null}, ${it.private}, ${it.homework})`;
  }
  refresh(sessionId);
  return { ok: `${t.items.length} Interaktionen aus „${t.label}“ eingefügt.` };
}
