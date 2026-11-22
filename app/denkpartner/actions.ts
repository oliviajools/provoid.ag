"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_PRO_PERSON, darfBearbeiten, einstellungen, ladeDenkpartner } from "@/lib/denkpartner";
import { FELDER, bauePrompt, mitStandard, type Felder } from "@/lib/denkpartner-prompt";

export type SaveState = { ok?: string; error?: string } | undefined;

export async function speichern(_: SaveState, form: FormData): Promise<SaveState> {
  const user = await requireUser();
  const { enabled } = await einstellungen(user);
  if (!enabled) return { error: "Der Denkpartner-Baukasten ist für deine AG gerade ausgeschaltet." };

  const meta = z.object({
    name: z.string().trim().min(2, "Gib deinem Denkpartner einen Namen.").max(60, "Der Name ist zu lang."),
    fach: z.string().trim().max(60),
    jahrgang: z.string().trim().max(30),
  }).safeParse({ name: form.get("name") ?? "", fach: form.get("fach") ?? "", jahrgang: form.get("jahrgang") ?? "" });
  if (!meta.success) return { error: meta.error.issues[0].message };

  const roh: Partial<Felder> = {};
  for (const f of FELDER) roh[f.id] = String(form.get(f.id) ?? "").replace(/\r\n/g, "\n").trim().slice(0, f.max);
  if ((roh.kontext ?? "").length < 10) return { error: "Beschreib in Baustein 2, um welche Klausur und welche Themen es geht." };
  if ((roh.ziel ?? "").length < 10) return { error: "Schreib in Baustein 3, was du am Ende selbst können willst." };
  const felder = mitStandard(roh);
  const prompt = bauePrompt(felder, meta.data);

  const id = String(form.get("id") ?? "");
  if (id) {
    const d = await ladeDenkpartner(id);
    if (!d || !darfBearbeiten(user, d)) return { error: "Diesen Denkpartner gibt es nicht mehr." };
    await sql`
      update denkpartner set name = ${meta.data.name}, fach = ${meta.data.fach}, jahrgang = ${meta.data.jahrgang},
        felder = ${sql.json(felder)}, prompt = ${prompt}, updated_at = now()
      where id = ${id}`;
    revalidatePath(`/denkpartner/${id}`);
    revalidatePath("/denkpartner");
    return { ok: "Gespeichert. Teste ihn gleich unten im Chat." };
  }

  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from denkpartner where user_id = ${user.id}`;
  if (n >= MAX_PRO_PERSON) return { error: `Du kannst höchstens ${MAX_PRO_PERSON} Denkpartner speichern. Lösch zuerst einen alten.` };
  const [neu] = await sql<{ id: string }[]>`
    insert into denkpartner (user_id, group_id, name, fach, jahrgang, felder, prompt)
    values (${user.id}, ${user.group_id}, ${meta.data.name}, ${meta.data.fach}, ${meta.data.jahrgang}, ${sql.json(felder)}, ${prompt})
    returning id`;
  revalidatePath("/denkpartner");
  redirect(`/denkpartner/${neu.id}?neu=1#chat`);
}

export async function loeschen(form: FormData) {
  const user = await requireUser();
  await sql`delete from denkpartner where id = ${String(form.get("id"))} and user_id = ${user.id}`;
  revalidatePath("/denkpartner");
  redirect("/denkpartner");
}
