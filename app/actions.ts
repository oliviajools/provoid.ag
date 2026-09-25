"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import {
  clearFailures, createSession, destroySession, getUser, hashPassword,
  isLockedOut, recordFailure, verifyPassword,
} from "@/lib/auth";
import { normalizeCode, passwordSchema, pseudonymSchema, type FormState } from "@/lib/validation";

const LOCKED = "Zu viele Fehlversuche. Bitte warte 15 Minuten und versuch es dann erneut.";

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const code = normalizeCode(String(form.get("code") ?? ""));
  const pseudonym = String(form.get("pseudonym") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const fields = { code, pseudonym };
  if (!code || !pseudonym || !password) return { error: "Bitte fülle alle drei Felder aus.", fields };

  const key = `student:${code}:${pseudonym.toLowerCase()}`;
  if (await isLockedOut(key)) return { error: LOCKED, fields };

  const rows = await sql<{ id: string; password_hash: string; disabled: boolean }[]>`
    select u.id, u.password_hash, u.disabled from users u join groups g on g.id = u.group_id
    where g.code = ${code} and u.role = 'student' and u.pseudonym_lower = ${pseudonym.toLowerCase()}`;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordFailure(key);
    return { error: "AG-Code, Pseudonym oder Passwort stimmen nicht.", fields };
  }
  if (user.disabled) return { error: "Dein Zugang ist pausiert. Sprich bitte kurz mit deiner Coach.", fields };

  await clearFailures(key);
  await createSession(user.id);
  redirect("/start");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const code = normalizeCode(String(form.get("code") ?? ""));
  const pseudonymRaw = String(form.get("pseudonym") ?? "");
  const password = String(form.get("password") ?? "");
  const password2 = String(form.get("password2") ?? "");
  const consent = form.get("consent") === "on";
  const fields = { code, pseudonym: pseudonymRaw.trim() };

  const group = (await sql<{ id: string; registration_open: boolean }[]>`
    select id, registration_open from groups where code = ${code}`)[0];
  if (!group) return { error: "Diesen AG-Code gibt es nicht. Prüf ihn bitte noch einmal.", fields };
  if (!group.registration_open) return { error: "Für diese AG ist die Anmeldung gerade geschlossen.", fields };

  const p = pseudonymSchema.safeParse(pseudonymRaw);
  if (!p.success) return { error: p.error.issues[0].message, fields };
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { error: pw.error.issues[0].message, fields };
  if (password !== password2) return { error: "Die beiden Passwörter sind nicht gleich.", fields };
  if (!consent) return { error: "Bitte bestätige die Datenschutzhinweise.", fields };

  try {
    const [u] = await sql<{ id: string }[]>`
      insert into users (group_id, role, pseudonym, pseudonym_lower, password_hash)
      values (${group.id}, 'student', ${p.data}, ${p.data.toLowerCase()}, ${await hashPassword(password)})
      returning id`;
    await createSession(u.id);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "23505") {
      return { error: "Dieses Pseudonym ist in deiner AG schon vergeben. Such dir ein anderes aus.", fields };
    }
    throw e;
  }
  redirect("/start");
}

export async function coachLogin(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const fields = { name };
  const key = `coach:${name.toLowerCase()}`;
  if (await isLockedOut(key)) return { error: LOCKED, fields };
  const user = (await sql<{ id: string; password_hash: string; disabled: boolean }[]>`
    select id, password_hash, disabled from users where role = 'coach' and pseudonym_lower = ${name.toLowerCase()}`)[0];
  if (!user || user.disabled || !(await verifyPassword(password, user.password_hash))) {
    await recordFailure(key);
    return { error: "Name oder Passwort stimmen nicht.", fields };
  }
  await clearFailures(key);
  await createSession(user.id);
  redirect("/coach");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const next2 = String(form.get("password2") ?? "");
  const row = (await sql<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`)[0];
  if (!(await verifyPassword(current, row.password_hash))) return { error: "Das aktuelle Passwort stimmt nicht." };
  const pw = passwordSchema.safeParse(next);
  if (!pw.success) return { error: pw.error.issues[0].message };
  if (next !== next2) return { error: "Die beiden neuen Passwörter sind nicht gleich." };
  if (next === current) return { error: "Das neue Passwort muss sich vom alten unterscheiden." };
  await sql`update users set password_hash = ${await hashPassword(next)}, must_change_password = false where id = ${user.id}`;
  // Alle anderen Sitzungen beenden, dann neu einloggen
  await sql`delete from sessions where user_id = ${user.id}`;
  await createSession(user.id);
  redirect(user.role === "coach" ? "/coach" : "/start");
}
