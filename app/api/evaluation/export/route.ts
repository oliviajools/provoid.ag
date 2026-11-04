import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { A1, EVALS, OPEN, SCENARIOS, scored, type EvalAnswers } from "@/lib/evaluation";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV für die Auswertung über das Jahr: eine Zeile pro Code, A1 bereits umgepolt. Nur für Coaches. */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "coach") return new Response("Nicht erlaubt.", { status: 403 });
  const url = new URL(req.url);
  const ag = url.searchParams.get("ag") ?? "";
  const def = EVALS[url.searchParams.get("bogen") ?? ""];
  if (!def || !/^[0-9a-f-]{36}$/i.test(ag)) return new Response("Ungültige Anfrage.", { status: 400 });
  const rows = await sql<{ code: string; submitted_on: string; answers: EvalAnswers }[]>`
    select code, to_char(submitted_on, 'YYYY-MM-DD') as submitted_on, answers
    from eval_responses where group_id = ${ag} and eval_id = ${def.id} order by code`;

  const head = ["code", "datum", ...A1.map((a) => a.id)];
  if (def.checks) head.push("vorher", "jetzt", ...def.checks.map((_, i) => `kurzcheck${i + 1}_richtig`), "interesse", "tempo", "bester_teil", ...OPEN.map((o) => o.id));
  if (def.scenarios) SCENARIOS.forEach((s) => head.push(`${s.id}_wahl`, `${s.id}_text`, `${s.id}_punkte`));

  const lines = rows.map(({ code, submitted_on, answers: a }) => {
    const out: unknown[] = [code, submitted_on, ...A1.map((it) => scored(it.id, a.a1[it.id]))];
    if (def.checks) {
      out.push(a.before, a.now, ...def.checks.map((c, i) => ((a.checks?.[i] ?? -1) < 0 ? "" : a.checks![i] === c.correct ? 1 : 0)),
        a.interest, a.tempo === undefined ? "" : ["zu langsam", "genau richtig", "zu schnell"][a.tempo],
        a.part === undefined ? "" : def.parts?.[a.part], ...OPEN.map((o) => a.open?.[o.id] ?? ""));
    }
    if (def.scenarios) SCENARIOS.forEach((s) => {
      const r = a.scen?.[s.id];
      out.push(s.opts && r && r.choice >= 0 ? "abcd"[r.choice] : "", r?.why ?? "", "");
    });
    return out.map(cell).join(";");
  });
  const body = "﻿" + [head.join(";"), ...lines].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="evaluation-${def.id}.csv"`,
    },
  });
}
