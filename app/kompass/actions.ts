"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { answersSchema } from "@/lib/compass";

export type SaveState = { error?: string } | undefined;

export async function saveCompass(_: SaveState, form: FormData): Promise<SaveState> {
  const user = await requireUser();
  if (user.role !== "student") return { error: "Coaches können den Kompass nur ansehen, nicht speichern." };
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("answers") ?? "")); } catch { return { error: "Die Antworten konnten nicht gelesen werden." }; }
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = parsed.data;
  await sql`
    insert into compass (user_id, round, answers, share_dream)
    values (${user.id}, 1, ${sql.json(a)}, ${a.share})
    on conflict (user_id, round) do update
      set answers = excluded.answers, share_dream = excluded.share_dream, updated_at = now()`;
  redirect("/kompass/karte?neu=1");
}
