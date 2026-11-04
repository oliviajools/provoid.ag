import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { A1, COMPETENCIES, EVALS, OPEN, SCENARIOS, TEMPO, scored, type EvalAnswers } from "@/lib/evaluation";

export const metadata: Metadata = { title: "Evaluation" };
export const dynamic = "force-dynamic";

const r1 = (n: number | null) => (n === null ? "–" : n.toFixed(1).replace(".", ","));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function Bar({ label, value, max = 5, note }: { label: string; value: number | null; max?: number; note?: string }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${value === null ? 0 : (value / max) * 100}%` }} /></div>
      <span className="v">{note ?? r1(value)}</span>
    </div>
  );
}

export default async function CoachEvaluation({ searchParams }: { searchParams: Promise<{ ag?: string; bogen?: string }> }) {
  const coach = await requireCoach();
  const { ag, bogen } = await searchParams;
  const groups = await sql<{ id: string; name: string }[]>`select id, name from groups order by created_at desc`;
  const group = groups.find((g) => g.id === ag) ?? groups[0];
  const def = EVALS[bogen ?? ""] ?? EVALS["2"];
  const rows = group
    ? await sql<{ answers: EvalAnswers }[]>`select answers from eval_responses where group_id = ${group.id} and eval_id = ${def.id}`
    : [];
  const n = rows.length;
  const all = rows.map((r) => r.answers);

  const comp = COMPETENCIES.map((c) => {
    const vals = all.flatMap((x) => A1.filter((it) => it.comp === c).map((it) => scored(it.id, x.a1[it.id])).filter((v): v is number => v !== null));
    return { c, m: mean(vals) };
  });
  const before = mean(all.map((x) => x.before).filter((v): v is number => !!v));
  const now = mean(all.map((x) => x.now).filter((v): v is number => !!v));
  const checks = (def.checks ?? []).map((c, ci) => {
    const answered = all.filter((x) => (x.checks?.[ci] ?? -1) >= 0);
    return { q: c.q, right: answered.filter((x) => x.checks![ci] === c.correct).length, total: answered.length };
  });
  const interest = mean(all.map((x) => x.interest).filter((v): v is number => !!v));
  const tempo = TEMPO.map((t, i) => [t, all.filter((x) => x.tempo === i).length] as const);
  const parts = (def.parts ?? []).map((p, i) => [p, all.filter((x) => x.part === i).length] as const);

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Evaluation, anonym</span>{group && <span className="tag">{group.name}</span>}</div>
              <h1>{def.label}: {n} {n === 1 ? "Antwort" : "Antworten"}</h1>
              <p className="muted">Ohne Namen gespeichert. Für Berichte an die Schule nur Gruppenwerte ab 5 Antworten weitergeben.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {groups.length > 1 && (
                  <select name="ag" defaultValue={group?.id} className="select" aria-label="AG wählen">
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                <select name="bogen" defaultValue={def.id} className="select" aria-label="Bogen wählen">
                  {Object.values(EVALS).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                <button className="btn ghost small" type="submit">Anzeigen</button>
              </form>
              {group && <a className="btn ghost" href={`/api/evaluation/export?ag=${group.id}&bogen=${def.id}`}>CSV mit Codes</a>}
              <Link className="btn ghost" href={`/evaluation/${def.id}`}>Bogen ansehen</Link>
            </div>
          </section>

          {n === 0 ? <p className="muted">Sobald die ersten Antworten da sind, erscheint hier die Auswertung.</p> : (
            <>
              <div className="two-col">
                <section className="card">
                  <header><h3>Kompetenzen</h3><span className="chip">Mittelwert 1 bis 5, umgepolt</span></header>
                  <div className="body"><div className="bars">{comp.map((x) => <Bar key={x.c} label={x.c} value={x.m} />)}</div></div>
                </section>
                {def.checks ? (
                  <section className="card">
                    <header><h3>Das Thema von heute</h3></header>
                    <div className="body">
                      <div className="bars">
                        <Bar label="vorher" value={before} />
                        <Bar label="jetzt" value={now} />
                      </div>
                      <p className="muted" style={{ margin: 0 }}>Lernzuwachs: {before !== null && now !== null ? `${now - before >= 0 ? "+" : ""}${r1(now - before)}` : "–"}</p>
                      {checks.map((c, i) => (
                        <p key={i} style={{ margin: 0 }}><b>Kurzcheck {i + 1}:</b> {c.right} von {c.total} richtig ({c.total ? Math.round((c.right / c.total) * 100) : 0} %). <span className="faint">{c.q}</span></p>
                      ))}
                    </div>
                  </section>
                ) : <section className="card"><header><h3>Teil C</h3></header><div className="body"><p className="muted">Die Antworten stehen unten. Bewertung je 0 bis 2 Punkte, am besten zu zweit.</p></div></section>}
              </div>

              {def.checks && (
                <section className="card">
                  <header><h3>Die Sitzung</h3><span className="chip">Interesse {r1(interest)}</span></header>
                  <div className="body two-col" style={{ gap: 24 }}>
                    <div className="bars">{tempo.map(([t, v]) => <Bar key={t} label={t} value={v} max={n} note={String(v)} />)}</div>
                    <div className="bars">{parts.map(([p, v]) => <Bar key={p} label={p} value={v} max={n} note={String(v)} />)}</div>
                  </div>
                </section>
              )}

              {def.checks && OPEN.map((o) => {
                const texts = all.map((x) => (x.open?.[o.id] ?? "").trim()).filter(Boolean);
                return (
                  <section className="card" key={o.id}>
                    <header><h3>{o.text}</h3><span className="chip">{texts.length}</span></header>
                    <div className="body"><div className="lr-notes">{texts.map((t, i) => <div className="lr-note" key={i}>{t}</div>)}</div></div>
                  </section>
                );
              })}

              {def.scenarios && SCENARIOS.map((s) => (
                <section className="card" key={s.id}>
                  <header><h3>{s.id.toUpperCase()} · {s.text}</h3><span className="chip">{s.comp}</span></header>
                  <div className="body">
                    <p className="faint" style={{ margin: 0 }}>{s.rubric}</p>
                    <div className="lr-notes">
                      {all.map((x, i) => {
                        const r = x.scen?.[s.id];
                        if (!r) return null;
                        const pick = s.opts && r.choice >= 0 ? `${"abcd"[r.choice]}) ` : "";
                        return <div className="lr-note" key={i}>{pick}{r.why}</div>;
                      })}
                    </div>
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </main>
    </>
  );
}
