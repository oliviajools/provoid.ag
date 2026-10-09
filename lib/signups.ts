import "server-only";
import { sql } from "./db";

export type SignupOption = { id: string; label: string; detail: string };
export type SignupForm = { id: string; slug: string; title: string; school: string; intro: string; options: SignupOption[]; open: boolean; runs_until: string };

export async function loadForm(slug: string) {
  return (await sql<SignupForm[]>`select id, slug, title, school, intro, options, open, runs_until from signup_forms where slug = ${slug}`)[0] ?? null;
}
