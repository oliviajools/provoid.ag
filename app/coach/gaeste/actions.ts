"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";

export type GuestState = { ok?: string; error?: string } | undefined;

const schema = z.object({
  id: z.string().uuid().or(z.literal("")),
  group_id: z.string().uuid(),
  name: z.string().trim().min(2, "Bitte gib den Namen des Gastes an.").max(120),
  role: z.string().trim().max(160),
  topic: z.string().trim().max(200),
  bio: z.string().trim().max(3000),
  link: z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Der Link muss mit https:// beginnen."),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  time_label: z.string().trim().max(40),
  session_id: z.string().uuid().or(z.literal("")),
});

function refresh() {
  revalidatePath("/coach/gaeste");
  revalidatePath("/gaeste");
  revalidatePath("/start");
}

export async function saveGuest(_: GuestState, form: FormData): Promise<GuestState> {
  await requireCoach();
  const p = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(form.get(k) ?? "")])));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const date = d.date || null;
  const session = d.session_id || null;
  if (d.id) {
    await sql`update guests set name = ${d.name}, role = ${d.role}, topic = ${d.topic}, bio = ${d.bio}, link = ${d.link},
              date = ${date}, time_label = ${d.time_label}, session_id = ${session} where id = ${d.id}`;
    refresh();
    return { ok: "Gespeichert." };
  }
  const [g] = await sql<{ id: string }[]>`
    insert into guests (group_id, name, role, topic, bio, link, date, time_label, session_id)
    values (${d.group_id}, ${d.name}, ${d.role}, ${d.topic}, ${d.bio}, ${d.link}, ${date}, ${d.time_label}, ${session})
    returning id`;
  refresh();
  redirect(`/coach/gaeste/${g.id}?neu=1`);
}

export async function guestToggle(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const field = String(form.get("field"));
  if (field === "published") await sql`update guests set published = not published where id = ${id}`;
  if (field === "questions") await sql`update guests set questions_open = not questions_open where id = ${id}`;
  refresh();
  revalidatePath(`/coach/gaeste/${id}`);
}

export async function deleteGuest(form: FormData) {
  await requireCoach();
  const [g] = await sql<{ group_id: string }[]>`delete from guests where id = ${String(form.get("id"))} returning group_id`;
  refresh();
  redirect(`/coach/gaeste${g ? `?ag=${g.group_id}` : ""}`);
}

export async function deleteQuestion(form: FormData) {
  await requireCoach();
  const [q] = await sql<{ guest_id: string }[]>`delete from guest_questions where id = ${String(form.get("id"))} returning guest_id`;
  if (q) revalidatePath(`/coach/gaeste/${q.guest_id}`);
}
