"use server";

import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CODE_RE, EVALS, answersSchema, normCode, validate } from "@/lib/evaluation";

export type EvalState = { ok?: boolean; error?: string } | undefined;

/**
 * Speichert eine Evaluation anonym: AG, Bogen, Code, Antworten, Datum.
 * Die Benutzer-ID wird nur gelesen, um die AG zu bestimmen, und nie gespeichert.
 */
export async function saveEvaluation(_: EvalState, form: FormData): Promise<EvalState> {
  const def = EVALS[String(form.get("eval_id") ?? "")];
  if (!def) return { error: "Diesen Bogen gibt es nicht." };

  const code = normCode(String(form.get("code") ?? ""));
  if (!CODE_RE.test(code)) return { error: "Bitte prüfe deinen Code: 2 Buchstaben, 2 Ziffern, 2 Buchstaben, zum Beispiel SA07KI." };

  let groupId: string | null = null;
  const user = await getUser();
  if (user?.role === "coach") return { error: "Das ist die Vorschau. Coaches können den Bogen nicht abschicken." };
  if (user?.role === "student") groupId = user.group_id;
  if (!groupId) {
    const ag = String(form.get("ag") ?? "").trim().toUpperCase();
    if (!ag) return { error: "Bitte gib den AG-Code ein." };
    groupId = (await sql<{ id: string }[]>`select id from groups where code = ${ag}`)[0]?.id ?? null;
    if (!groupId) return { error: "Diesen AG-Code kennen wir nicht." };
  }

  let raw: unknown;
  try { raw = JSON.parse(String(form.get("answers") ?? "")); } catch { return { error: "Die Antworten konnten nicht gelesen werden." }; }
  const parsed = answersSchema.safeParse(raw);
  if (!parsed.success) return { error: "Die Antworten konnten nicht gelesen werden." };
  const problem = validate(def, parsed.data);
  if (problem) return { error: problem };

  // Derselbe Code im selben Bogen ersetzt die frühere Antwort (zum Beispiel nach einer Korrektur).
  await sql`
    insert into eval_responses (group_id, eval_id, code, answers)
    values (${groupId}, ${def.id}, ${code}, ${sql.json(parsed.data)})
    on conflict (group_id, eval_id, code) do update set answers = excluded.answers, submitted_on = current_date`;
  return { ok: true };
}
