import "server-only";
import { sql } from "./db";

export type SignupOption = { id: string; label: string; detail: string; capacity: number };
export type SignupForm = { id: string; slug: string; title: string; school: string; intro: string; options: SignupOption[]; open: boolean };

export async function loadForm(slug: string) {
  return (await sql<SignupForm[]>`select id, slug, title, school, intro, options, open from signup_forms where slug = ${slug}`)[0] ?? null;
}

export async function countsFor(formId: string) {
  const rows = await sql<{ option_id: string; n: number }[]>`
    select option_id, count(*)::int as n from signups where form_id = ${formId} and not waitlist group by option_id`;
  return Object.fromEntries(rows.map((r) => [r.option_id, r.n])) as Record<string, number>;
}
