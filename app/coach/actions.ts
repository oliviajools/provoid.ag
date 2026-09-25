"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { hashPassword, requireCoach } from "@/lib/auth";
import { normalizeCode, type FormState } from "@/lib/validation";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O und 1/I, damit nichts verwechselt wird
const randomChars = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const groupSchema = z.object({
  name: z.string().trim().min(2, "Bitte gib der AG einen Namen.").max(80),
  school: z.string().trim().max(80),
  code: z.string().max(16).regex(/^[A-Z0-9]*$/, "Der AG-Code darf nur Buchstaben und Zahlen enthalten."),
  starts_on: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
});

export async function createGroup(_: FormState, form: FormData): Promise<FormState> {
  await requireCoach();
  const parsed = groupSchema.safeParse({
    name: form.get("name") ?? "",
    school: form.get("school") ?? "",
    code: normalizeCode(String(form.get("code") ?? "")),
    starts_on: form.get("starts_on") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const prefix = (d.school || d.name).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "AG";
  const code = d.code || prefix + randomChars(4);
  if (code.length < 4) return { error: "Der AG-Code braucht mindestens 4 Zeichen." };
  try {
    await sql`insert into groups (name, school, code, starts_on)
              values (${d.name}, ${d.school}, ${code}, ${d.starts_on || null})`;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") return { error: `Der Code ${code} ist schon vergeben.` };
    throw e;
  }
  revalidatePath("/coach");
  return { ok: `AG angelegt. Der AG-Code lautet ${code}.` };
}

export async function toggleRegistration(form: FormData) {
  await requireCoach();
  const id = String(form.get("group_id"));
  await sql`update groups set registration_open = not registration_open where id = ${id}`;
  revalidatePath("/coach");
}

export async function toggleDisabled(form: FormData) {
  await requireCoach();
  const id = String(form.get("user_id"));
  const [u] = await sql<{ disabled: boolean }[]>`
    update users set disabled = not disabled where id = ${id} and role = 'student' returning disabled`;
  if (u?.disabled) await sql`delete from sessions where user_id = ${id}`;
  revalidatePath("/coach");
}

export type ResetState = { pseudonym: string; password: string } | { error: string } | undefined;

export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  await requireCoach();
  const id = String(form.get("user_id"));
  // Leicht diktierbares Übergangspasswort, muss beim nächsten Login geändert werden
  const temp = `${randomChars(4)}-${randomChars(4)}`;
  const [u] = await sql<{ pseudonym: string }[]>`
    update users set password_hash = ${await hashPassword(temp)}, must_change_password = true
    where id = ${id} and role = 'student' returning pseudonym`;
  if (!u) return { error: "Konto nicht gefunden." };
  await sql`delete from sessions where user_id = ${id}`;
  await sql`delete from login_attempts where key like ${"student:%:" + u.pseudonym.toLowerCase()}`;
  return { pseudonym: u.pseudonym, password: temp };
}
