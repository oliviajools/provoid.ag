"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { sql } from "@/lib/db";
import { isLockedOut, recordFailure } from "@/lib/auth";
import { loadForm } from "@/lib/signups";

export type SignupState =
  | { error?: string; fields?: Record<string, string> }
  | { done: true; child: string; option: string; email: string }
  | undefined;

const schema = z.object({
  option_id: z.string().min(1, "Bitte wählen Sie eine Gruppe."),
  child_first: z.string().trim().min(1, "Bitte geben Sie den Vornamen Ihres Kindes an.").max(80),
  child_last: z.string().trim().min(1, "Bitte geben Sie den Nachnamen Ihres Kindes an.").max(80),
  class_name: z.string().trim().min(1, "Bitte geben Sie die Klasse an, zum Beispiel 9b.").max(20),
  parent_name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen an.").max(120),
  email: z.string().trim().email("Bitte prüfen Sie die E-Mail-Adresse.").max(200),
  phone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
  photo_ok: z.boolean(),
  consent_participation: z.literal(true, { message: "Bitte bestätigen Sie die Teilnahme." }),
  consent_platform: z.literal(true, { message: "Bitte stimmen Sie der Nutzung der Lernplattform zu." }),
  consent_privacy: z.literal(true, { message: "Bitte bestätigen Sie die Datenschutzhinweise." }),
});

export async function submitSignup(slug: string, _: SignupState, form: FormData): Promise<SignupState> {
  const f = await loadForm(slug);
  if (!f || !f.open) return { error: "Die Anmeldung ist geschlossen." };
  const fields = Object.fromEntries(["option_id", "child_first", "child_last", "class_name", "parent_name", "email", "phone", "notes"].map((k) => [k, String(form.get(k) ?? "")]));
  // Schutz vor Spam: verstecktes Feld muss leer bleiben, und höchstens 8 Anmeldungen pro Stunde und Anschluss
  if (String(form.get("website") ?? "") !== "") return { error: "Die Anmeldung konnte nicht gespeichert werden." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
  const key = `signup:${createHash("sha256").update(ip + slug).digest("hex").slice(0, 32)}`;
  if (await isLockedOut(key)) return { error: "Zu viele Anmeldungen in kurzer Zeit. Bitte versuchen Sie es später noch einmal.", fields };

  const p = schema.safeParse({
    ...fields,
    photo_ok: form.get("photo_ok") === "on",
    consent_participation: form.get("consent_participation") === "on",
    consent_platform: form.get("consent_platform") === "on",
    consent_privacy: form.get("consent_privacy") === "on",
  });
  if (!p.success) return { error: p.error.issues[0].message, fields };
  const d = p.data;
  const option = f.options.find((o) => o.id === d.option_id);
  if (!option) return { error: "Bitte wählen Sie eine Gruppe.", fields };

  const dup = await sql`select 1 from signups where form_id = ${f.id} and lower(child_first) = lower(${d.child_first})
                        and lower(child_last) = lower(${d.child_last}) and lower(class_name) = lower(${d.class_name})`;
  if (dup.length) return { error: "Für dieses Kind liegt bereits eine Anmeldung vor. Bei Änderungen melden Sie sich bitte direkt bei uns.", fields };

  await sql`
    insert into signups (form_id, option_id, child_first, child_last, class_name, parent_name, email, phone, photo_ok, notes)
    values (${f.id}, ${option.id}, ${d.child_first}, ${d.child_last}, ${d.class_name}, ${d.parent_name}, ${d.email}, ${d.phone},
            ${d.photo_ok}, ${d.notes})`;
  await recordFailure(key); // zählt die Anmeldung für die Begrenzung pro Stunde
  return { done: true, child: `${d.child_first} ${d.child_last}`, option: option.label, email: d.email };
}
