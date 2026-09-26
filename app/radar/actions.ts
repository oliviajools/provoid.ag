"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { REACTIONS, type ReactionId } from "@/lib/reactions";

export type Counts = Record<ReactionId, number>;

export async function react(itemId: string, reaction: ReactionId): Promise<Counts> {
  const user = await requireUser();
  if (!REACTIONS.some((r) => r.id === reaction)) throw new Error("Unbekannte Reaktion");
  await sql`
    insert into news_reactions (item_id, user_id, reaction) values (${itemId}, ${user.id}, ${reaction})
    on conflict (item_id, user_id) do update set reaction = excluded.reaction, created_at = now()`;
  return countsFor(itemId);
}

export async function countsFor(itemId: string): Promise<Counts> {
  const rows = await sql<{ reaction: ReactionId; n: number }[]>`
    select reaction, count(*)::int as n from news_reactions where item_id = ${itemId} group by reaction`;
  const c = { krass: 0, sorge: 0, hype: 0, testen: 0 } as Counts;
  for (const r of rows) c[r.reaction] = r.n;
  return c;
}

const submitSchema = z.object({
  url: z.string().trim().url("Das sieht nicht wie ein Link aus. Kopier am besten die ganze Adresse aus dem Browser.")
    .refine((u) => /^https?:\/\//i.test(u), "Der Link muss mit http oder https beginnen."),
  note: z.string().trim().min(10, "Schreib in einem Satz, warum du das spannend findest.").max(500),
  who: z.string().trim().max(120),
  when: z.string().trim().max(60),
  evidence: z.enum(["ja", "nein", "unklar"], { message: "Beantworte bitte die Frage nach den Belegen." }),
});

export type SubmitState = { error?: string; ok?: string } | undefined;

export async function submitSource(_: SubmitState, form: FormData): Promise<SubmitState> {
  const user = await requireUser();
  if (user.role !== "student" || !user.group_id) return { error: "Einreichen ist nur für Mitglieder einer AG möglich." };
  const parsed = submitSchema.safeParse({
    url: form.get("url"), note: form.get("note"), who: form.get("who") ?? "", when: form.get("when") ?? "", evidence: form.get("evidence") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from news_items where submitted_by = ${user.id} and created_at > now() - interval '1 day'`;
  if (n >= 10) return { error: "Du hast heute schon zehn Quellen eingereicht. Morgen geht es weiter." };
  const dup = await sql`select 1 from news_items where url = ${d.url} and (group_id = ${user.group_id} or group_id is null) and status <> 'rejected'`;
  if (dup.length) return { error: "Diesen Link hat schon jemand eingereicht. Gutes Gespür!" };
  let host = "";
  try { host = new URL(d.url).hostname.replace(/^www\./, ""); } catch { /* bereits geprüft */ }
  await sql`
    insert into news_items (group_id, origin, submitted_by, url, source_name, kid_note, kid_check)
    values (${user.group_id}, 'kid', ${user.id}, ${d.url}, ${host}, ${d.note},
            ${sql.json({ who: d.who, when: d.when, evidence: d.evidence })})`;
  revalidatePath("/radar/einreichen");
  return { ok: "Danke! Deine Quelle liegt jetzt bei deiner Coach zur Prüfung." };
}
