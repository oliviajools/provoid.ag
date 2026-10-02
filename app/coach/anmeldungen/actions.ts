"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";

export async function signupAction(form: FormData) {
  await requireCoach();
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  if (op === "delete") await sql`delete from signups where id = ${id}`;
  if (op === "waitlist") await sql`update signups set waitlist = not waitlist where id = ${id}`;
  revalidatePath("/coach/anmeldungen");
}

export async function toggleForm(form: FormData) {
  await requireCoach();
  await sql`update signup_forms set open = not open where id = ${String(form.get("id"))}`;
  revalidatePath("/coach/anmeldungen");
}
