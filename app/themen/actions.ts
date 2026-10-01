"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireCoach, requireUser } from "@/lib/auth";

export type WishState = { ok?: string; error?: string } | undefined;

export async function addWish(_: WishState, form: FormData): Promise<WishState> {
  const user = await requireUser();
  if (user.role !== "student" || !user.group_id) return { error: "Themen können nur Mitglieder einer AG eintragen." };
  const p = z.object({
    title: z.string().trim().min(3, "Beschreib dein Thema in ein paar Worten.").max(120, "Halte die Überschrift kurz, Details kommen ins zweite Feld."),
    details: z.string().trim().max(600),
    anonymous: z.boolean(),
  }).safeParse({ title: form.get("title") ?? "", details: form.get("details") ?? "", anonymous: form.get("anonymous") === "on" });
  if (!p.success) return { error: p.error.issues[0].message };
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from topic_wishes where user_id = ${user.id} and created_at > now() - interval '1 day'`;
  if (n >= 5) return { error: "Du hast heute schon fünf Themen eingetragen. Morgen geht es weiter." };
  const [w] = await sql<{ id: string }[]>`
    insert into topic_wishes (group_id, user_id, title, details, anonymous)
    values (${user.group_id}, ${user.id}, ${p.data.title}, ${p.data.details}, ${p.data.anonymous}) returning id`;
  await sql`insert into topic_votes (wish_id, user_id) values (${w.id}, ${user.id}) on conflict do nothing`;
  revalidatePath("/themen");
  return { ok: "Eingetragen. Jetzt können die anderen mitstimmen." };
}

export async function toggleVote(form: FormData) {
  const user = await requireUser();
  if (user.role !== "student") return;
  const id = String(form.get("id"));
  const ok = await sql`select 1 from topic_wishes where id = ${id} and group_id = ${user.group_id} and status <> 'hidden'`;
  if (!ok.length) return;
  const del = await sql`delete from topic_votes where wish_id = ${id} and user_id = ${user.id} returning wish_id`;
  if (!del.length) await sql`insert into topic_votes (wish_id, user_id) values (${id}, ${user.id}) on conflict do nothing`;
  revalidatePath("/themen");
}

export async function deleteOwnWish(form: FormData) {
  const user = await requireUser();
  await sql`delete from topic_wishes where id = ${String(form.get("id"))} and user_id = ${user.id}`;
  revalidatePath("/themen");
}

export async function setWishStatus(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const op = String(form.get("op") ?? "");
  if (op === "delete") {
    await sql`delete from topic_wishes where id = ${id}`;
  } else {
    const status = z.enum(["open", "planned", "done", "hidden"]).catch("open").parse(form.get("status"));
    const note = String(form.get("note") ?? "").trim().slice(0, 200);
    await sql`update topic_wishes set status = ${status}, coach_note = ${note} where id = ${id}`;
  }
  revalidatePath("/themen");
}
