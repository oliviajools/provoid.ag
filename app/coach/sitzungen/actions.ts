"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";

export type ActState = { ok?: string; error?: string } | undefined;

const phase = z.enum(["durchschauen", "einordnen", "bauen", ""]).transform((v) => (v === "" ? null : v));
const dateStr = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).transform((v) => v || null);

function refresh(id?: string) {
  revalidatePath("/coach/sitzungen");
  revalidatePath("/sitzungen");
  if (id) { revalidatePath(`/coach/sitzungen/${id}`); revalidatePath(`/sitzungen/${id}`); }
}

export async function createSession(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const p = z.object({ group_id: z.string().uuid(), title: z.string().trim().max(160), date: dateStr, phase })
    .safeParse({ group_id: form.get("group_id"), title: form.get("title") ?? "", date: form.get("date") ?? "", phase: form.get("phase") ?? "" });
  if (!p.success) return { error: "Bitte prüfe die Angaben." };
  const [row] = await sql<{ id: string }[]>`
    insert into ag_sessions (group_id, number, title, date, phase)
    values (${p.data.group_id}, (select coalesce(max(number), 0) + 1 from ag_sessions where group_id = ${p.data.group_id}),
            ${p.data.title}, ${p.data.date}, ${p.data.phase})
    returning id`;
  redirect(`/coach/sitzungen/${row.id}`);
}

export async function createSeries(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const p = z.object({
    group_id: z.string().uuid(),
    first: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte das Datum der ersten Sitzung angeben."),
    count: z.coerce.number().int().min(1).max(40),
    every: z.coerce.number().int().min(1).max(31),
  }).safeParse({ group_id: form.get("group_id"), first: form.get("first"), count: form.get("count"), every: form.get("every") });
  if (!p.success) return { error: p.error.issues[0].message };
  const { group_id, first, count, every } = p.data;
  const [{ max }] = await sql<{ max: number }[]>`select coalesce(max(number), 0)::int as max from ag_sessions where group_id = ${group_id}`;
  for (let i = 0; i < count; i++) {
    await sql`insert into ag_sessions (group_id, number, date)
              values (${group_id}, ${max + i + 1}, ${first}::date + ${i * every}::int)`;
  }
  refresh();
  return { ok: `${count} Sitzungen angelegt. Passe Datum und Titel an, wo nötig (zum Beispiel in den Ferien).` };
}

export async function updateSession(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const p = z.object({
    id: z.string().uuid(),
    number: z.coerce.number().int().min(0).max(999),
    title: z.string().trim().max(160),
    date: dateStr,
    phase,
    summary: z.string().trim().max(4000),
  }).safeParse(Object.fromEntries(["id", "number", "title", "date", "phase", "summary"].map((k) => [k, form.get(k) ?? ""])));
  if (!p.success) return { error: "Bitte prüfe die Angaben." };
  const d = p.data;
  await sql`update ag_sessions set number = ${d.number}, title = ${d.title}, date = ${d.date}, phase = ${d.phase}, summary = ${d.summary} where id = ${d.id}`;
  refresh(d.id);
  return { ok: "Gespeichert." };
}

export async function togglePublished(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  await sql`update ag_sessions set published = not published where id = ${id}`;
  refresh(id);
}

export async function deleteSession(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const [s] = await sql<{ group_id: string }[]>`delete from ag_sessions where id = ${id} returning group_id`;
  refresh();
  redirect(`/coach/sitzungen${s ? `?ag=${s.group_id}` : ""}`);
}

export async function addLink(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const p = z.object({
    session_id: z.string().uuid(),
    url: z.string().trim().url("Bitte einen vollständigen Link mit https:// angeben.").refine((u) => /^https?:\/\//i.test(u), "Der Link muss mit http oder https beginnen."),
    title: z.string().trim().max(200),
    body: z.string().trim().max(1000),
  }).safeParse({ session_id: form.get("session_id"), url: form.get("url"), title: form.get("title") ?? "", body: form.get("body") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  await sql`insert into materials (session_id, kind, title, url, body, position)
            values (${d.session_id}, 'link', ${d.title || new URL(d.url).hostname.replace(/^www\./, "")}, ${d.url}, ${d.body},
                    (select coalesce(max(position), 0) + 1 from materials where session_id = ${d.session_id}))`;
  refresh(d.session_id);
  return { ok: "Link hinzugefügt." };
}

export async function addText(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const p = z.object({
    session_id: z.string().uuid(),
    title: z.string().trim().min(2, "Bitte gib dem Text eine Überschrift.").max(200),
    body: z.string().trim().min(2, "Der Text ist leer.").max(20000),
  }).safeParse({ session_id: form.get("session_id"), title: form.get("title") ?? "", body: form.get("body") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  await sql`insert into materials (session_id, kind, title, body, position)
            values (${d.session_id}, 'text', ${d.title}, ${d.body},
                    (select coalesce(max(position), 0) + 1 from materials where session_id = ${d.session_id}))`;
  refresh(d.session_id);
  return { ok: "Text hinzugefügt." };
}

export async function materialAction(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  const [m] = await sql<{ session_id: string; position: number }[]>`select session_id, position from materials where id = ${id}`;
  if (!m) return;
  if (op === "delete") await sql`delete from materials where id = ${id}`;
  if (op === "up" || op === "down") {
    const [other] = op === "up"
      ? await sql<{ id: string; position: number }[]>`select id, position from materials where session_id = ${m.session_id} and position < ${m.position} order by position desc limit 1`
      : await sql<{ id: string; position: number }[]>`select id, position from materials where session_id = ${m.session_id} and position > ${m.position} order by position asc limit 1`;
    if (other) {
      await sql`update materials set position = ${other.position} where id = ${id}`;
      await sql`update materials set position = ${m.position} where id = ${other.id}`;
    }
  }
  refresh(m.session_id);
}

export async function renameMaterial(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const [m] = await sql<{ session_id: string }[]>`update materials set title = ${title} where id = ${id} returning session_id`;
  if (m) refresh(m.session_id);
}

/** Anwesenheit und Protokoll einer Sitzung speichern. Felder: att:<user_id> = present | excused | absent | "" */
export async function saveAttendance(_: ActState, form: FormData): Promise<ActState> {
  await requireCoach();
  const id = String(form.get("session_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Sitzung nicht gefunden." };
  const [s] = await sql<{ group_id: string }[]>`select group_id from ag_sessions where id = ${id}`;
  if (!s) return { error: "Sitzung nicht gefunden." };
  const members = await sql<{ id: string }[]>`select id from users where group_id = ${s.group_id} and role = 'student'`;
  const ids = new Set(members.map((m) => m.id));
  const restAbsent = form.get("rest_absent") === "on";
  let n = 0;
  for (const uid of ids) {
    const raw = String(form.get(`att:${uid}`) ?? "");
    const status = raw === "present" || raw === "excused" || raw === "absent" ? raw : restAbsent ? "absent" : "";
    if (status) {
      // Unveränderte automatische Einträge bleiben automatisch, alles andere gilt als von der Coach gesetzt
      await sql`
        insert into attendance (session_id, user_id, status, source) values (${id}, ${uid}, ${status}, 'manual')
        on conflict (session_id, user_id) do update
          set status = excluded.status, marked_at = now(),
              source = case when attendance.status = excluded.status then attendance.source else 'manual' end`;
      n++;
    } else {
      await sql`delete from attendance where session_id = ${id} and user_id = ${uid}`;
    }
  }
  const protocol = String(form.get("protocol") ?? "").slice(0, 5000);
  await sql`update ag_sessions set protocol = ${protocol} where id = ${id}`;
  revalidatePath(`/coach/sitzungen/${id}`);
  revalidatePath("/coach/dokumentation");
  return { ok: `Gespeichert: ${n} ${n === 1 ? "Eintrag" : "Einträge"}.` };
}
