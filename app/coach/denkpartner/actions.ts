"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";

export async function einstellen(form: FormData) {
  await requireCoach();
  const id = String(form.get("group_id") ?? "");
  const enabled = form.get("enabled") === "on";
  const limit = Math.max(0, Math.min(500, Math.round(Number(form.get("limit") ?? 60)) || 0));
  await sql`update groups set dp_enabled = ${enabled}, dp_limit = ${limit} where id = ${id}`;
  revalidatePath("/coach/denkpartner");
}
