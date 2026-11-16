import "server-only";
import { cookies } from "next/headers";
import { sql } from "./db";

/** Merkt sich, welche AG die Coach zuletzt gewählt hat (gilt für alle Coach-Seiten). */
export const AG_COOKIE = "coach_ag";

export type GroupOpt = {
  id: string; name: string; school: string; short_name: string; cohort: string; schedule: string;
  code: string; starts: string | null; starts_iso: string | null; nr: number; label: string;
};

/** Anzeigename, der die AGs eindeutig trennt, z. B. „1 · GymEpp · Mi 14:05“. */
function labelOf(g: Omit<GroupOpt, "label">) {
  const who = [g.short_name || g.school || g.name, g.cohort].filter(Boolean).join(" ");
  const when = g.schedule || (g.starts ? `ab ${g.starts}` : "");
  return [`${g.nr}`, who, when].filter(Boolean).join(" · ");
}

/** Alle AGs, die älteste zuerst (nach erstem Termin, dann nach Anlegedatum). */
export async function listGroups(): Promise<GroupOpt[]> {
  const rows = await sql<Omit<GroupOpt, "label" | "nr">[]>`
    select id, name, school, short_name, cohort, schedule, code,
           to_char(starts_on, 'DD.MM.YYYY') as starts, to_char(starts_on, 'YYYY-MM-DD') as starts_iso
    from groups order by starts_on asc nulls last, created_at asc`;
  return rows.map((r, i) => { const g = { ...r, nr: i + 1 }; return { ...g, label: labelOf(g) }; });
}

/** Gewählte AG: erst aus der Adresse (?ag=), dann die zuletzt gewählte, sonst die erste. */
export async function pickGroup(groups: GroupOpt[], ag?: string | null) {
  const byParam = ag ? groups.find((g) => g.id === ag) : undefined;
  if (byParam) return byParam;
  const remembered = (await cookies()).get(AG_COOKIE)?.value;
  return groups.find((g) => g.id === remembered) ?? groups[0];
}
