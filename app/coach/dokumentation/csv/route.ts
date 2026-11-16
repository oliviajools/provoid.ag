import { getUser } from "@/lib/auth";
import { listGroups } from "@/lib/groups";
import { loadDocumentation } from "@/lib/documentation";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Anwesenheitsliste als CSV (Semikolon, öffnet direkt in Excel und Numbers). */
export async function GET(req: Request) {
  const user = await getUser();
  if (user?.role !== "coach") return new Response("Nicht erlaubt.", { status: 403 });
  const ag = new URL(req.url).searchParams.get("ag");
  const group = (await listGroups()).find((g) => g.id === ag);
  if (!group) return new Response("AG nicht gefunden.", { status: 404 });
  const doc = await loadDocumentation(group.id);
  const held = doc.sessions.filter((s) => s.held);
  const mark = { present: "da", excused: "entschuldigt", absent: "fehlt" } as const;
  const lines: string[] = [];
  lines.push([group.label].map(cell).join(";"));
  lines.push(["Sitzung", "Datum", "Thema", "Anwesend", "Protokoll"].map(cell).join(";"));
  for (const s of held) {
    const n = doc.att.filter((a) => a.session_id === s.id && a.status === "present").length;
    lines.push([s.number, s.date_iso ?? "", s.title, n, s.protocol].map(cell).join(";"));
  }
  lines.push("");
  lines.push(["Name", ...held.map((s) => `S${s.number} ${s.date_iso ?? ""}`.trim()), "da", "von"].map(cell).join(";"));
  for (const m of doc.members) {
    const marks = held.map((s) => doc.att.find((a) => a.session_id === s.id && a.user_id === m.id)?.status ?? null);
    lines.push([m.pseudonym, ...marks.map((x) => (x ? mark[x] : "")), marks.filter((x) => x === "present").length, held.length].map(cell).join(";"));
  }
  const name = `Anwesenheit_${(group.short_name || group.name).replace(/[^A-Za-z0-9]+/g, "")}${group.cohort ? "_" + group.cohort.replace(/[^0-9]+/g, "-").replace(/^-|-$/g, "") : ""}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
