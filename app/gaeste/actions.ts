"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type AskState = { ok?: string; error?: string } | undefined;

export async function askQuestion(_: AskState, form: FormData): Promise<AskState> {
  const user = await requireUser();
  if (user.role !== "student") return { error: "Fragen stellen können Teilnehmende." };
  const guestId = String(form.get("guest_id"));
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 5) return { error: "Deine Frage ist noch etwas kurz." };
  if (body.length > 500) return { error: "Bitte fasse dich kürzer (höchstens 500 Zeichen)." };
  const ok = await sql`select 1 from guests where id = ${guestId} and group_id = ${user.group_id} and published and questions_open`;
  if (!ok.length) return { error: "Für diesen Gast können gerade keine Fragen gestellt werden." };
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from guest_questions where guest_id = ${guestId} and user_id = ${user.id}`;
  if (n >= 3) return { error: "Du hast schon drei Fragen gestellt. Heb dir die nächste für den Besuch auf!" };
  await sql`insert into guest_questions (guest_id, user_id, body) values (${guestId}, ${user.id}, ${body})`;
  revalidatePath("/gaeste");
  return { ok: "Deine Frage ist angekommen." };
}

export async function deleteMyQuestion(form: FormData) {
  const user = await requireUser();
  await sql`delete from guest_questions where id = ${String(form.get("id"))} and user_id = ${user.id}`;
  revalidatePath("/gaeste");
}
