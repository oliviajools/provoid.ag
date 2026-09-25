import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { Radar } from "@/components/Radar";
import {
  FEELINGS, FREQUENCY, GOAL_DIRECTIONS, PAIRS, SKILLS, THEMES, USAGE, topThemes, type Answers, type ThemeKey,
} from "@/lib/compass";

export const metadata: Metadata = { title: "Kompass-Auswertung" };
export const dynamic = "force-dynamic";

type Row = { pseudonym: string; answers: Answers | null; share_dream: string | null };

function Bars({ items, total }: { items: [string, number][]; total: number }) {
  return (
    <div className="bars">
      {items.map(([label, v]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div>
          <span className="v">{v}</span>
        </div>
      ))}
    </div>
  );
}

export default async function CoachKompass({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const coach = await requireCoach();
  const { ag } = await searchParams;
  const groups = await sql<{ id: string; name: string }[]>`select id, name from groups order by created_at desc`;
  const group = groups.find((g) => g.id === ag) ?? groups[0];

  const rows = group
    ? await sql<Row[]>`
        select u.pseudonym, c.answers, c.share_dream
        from users u left join compass c on c.user_id = u.id and c.round = 1
        where u.group_id = ${group.id} and u.role = 'student' and u.disabled = false
        order by u.pseudonym_lower`
    : [];
  const done = rows.flatMap((r) => (r.answers ? [{ ...r, answers: r.answers }] : []));
  const missing = rows.filter((r) => !r.answers).map((r) => r.pseudonym);
  const n = done.length;

  const count = <T extends string>(keys: readonly T[], pick: (a: Answers) => T[]) =>
    keys.map((k) => [k, done.filter((r) => pick(r.answers).includes(k)).length] as [string, number])
      .sort((x, y) => y[1] - x[1]);

  const themeKeys = Object.keys(THEMES) as ThemeKey[];
  const themeCounts = themeKeys
    .map((t) => [THEMES[t], done.filter((r) => topThemes(r.answers.cards).includes(t)).length] as [string, number])
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const clusters = themeKeys
    .map((t) => ({ t, names: done.filter((r) => topThemes(r.answers.cards).includes(t)).map((r) => r.pseudonym) }))
    .filter((c) => c.names.length > 1).sort((a, b) => b.names.length - a.names.length);

  const avgSkills: Record<string, number> = {};
  for (const s of SKILLS) avgSkills[s.id] = n ? Math.round((done.reduce((acc, r) => acc + (r.answers.skills[s.id] ?? 0), 0) / n) * 10) / 10 : 0;

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 40 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Kompass-Auswertung</span>{group && <span className="tag">{group.name}</span>}</div>
              <h1>{n} von {rows.length} haben ihren Kompass ausgefüllt.</h1>
              {missing.length > 0 && <p className="muted">Noch offen: {missing.join(", ")}</p>}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {groups.length > 1 && (
                <form style={{ display: "flex", gap: 8 }}>
                  <select name="ag" defaultValue={group?.id} className="select" aria-label="AG wählen">
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button className="btn ghost small" type="submit">Anzeigen</button>
                </form>
              )}
              <Link className="btn ghost" href={`/ideen${group ? `?ag=${group.id}` : ""}`}>Ideen-Wand</Link>
              <Link className="btn ghost" href="/kompass">Befragung ansehen</Link>
            </div>
          </section>

          {n === 0 ? <p className="muted">Sobald die ersten Antworten da sind, erscheint hier die Auswertung.</p> : (
            <>
              <div className="two-col">
                <section className="card">
                  <header><h3>Themenfelder der Gruppe</h3><span className="chip">Top 3 je Person</span></header>
                  <div className="body"><Bars items={themeCounts} total={n} /></div>
                </section>
                <section className="card">
                  <header><h3>Mögliche Projektteams</h3><span className="chip">gleiches Themenfeld</span></header>
                  <div className="body">
                    {clusters.length === 0 ? <p className="muted">Noch keine Überschneidungen.</p> : clusters.map((c) => (
                      <div className="cluster" key={c.t}>
                        <b style={{ color: "var(--text)" }}>{THEMES[c.t]}</b>
                        <div className="names">{c.names.map((x) => <span key={x}>{x}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="two-col">
                <section className="card">
                  <header><h3>Startpunkt der Gruppe</h3><span className="chip">Durchschnitt</span></header>
                  <div className="body"><Radar values={avgSkills} label="Durchschnittliche Selbsteinschätzung der Gruppe" /></div>
                </section>
                <section className="card">
                  <header><h3>Wie arbeitet die Gruppe?</h3></header>
                  <div className="body">
                    {PAIRS.map((p) => {
                      const l = done.filter((r) => r.answers.pairs[p.id] === "left").length;
                      const b = done.filter((r) => r.answers.pairs[p.id] === "both").length;
                      const rr = done.filter((r) => r.answers.pairs[p.id] === "right").length;
                      return (
                        <div key={p.id} className="stack" style={{ gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: "var(--muted)" }}>
                            <span>{p.left} · {l}</span><span>{rr} · {p.right}</span>
                          </div>
                          <div style={{ display: "flex", height: 10, background: "var(--surface-2)" }}>
                            <div style={{ width: `${(l / n) * 100}%`, background: "var(--accent)" }} />
                            <div style={{ width: `${(b / n) * 100}%`, background: "var(--line)" }} title={`beides: ${b}`} />
                            <div style={{ width: `${(rr / n) * 100}%`, background: "#E4E1FF" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="two-col">
                <section className="card">
                  <header><h3>Gefühl beim Thema KI</h3></header>
                  <div className="body"><Bars items={count(FEELINGS, (a) => a.feelings)} total={n} /></div>
                </section>
                <section className="card">
                  <header><h3>Aktuelle Nutzung</h3></header>
                  <div className="body">
                    <Bars items={count(USAGE, (a) => a.usage)} total={n} />
                    <p className="faint">Häufigkeit: {FREQUENCY.map((f) => `${f} ${done.filter((r) => r.answers.frequency === f).length}`).join(" · ")}</p>
                  </div>
                </section>
              </div>

              <section className="card">
                <header><h3>Alle Kompass-Karten</h3><span className="chip">nur für dich sichtbar</span></header>
                <div className="body table-wrap">
                  <table>
                    <thead><tr><th>Pseudonym</th><th>Themen</th><th>Traumprojekt</th><th>Ziel bis März</th><th>Ideen-Wand</th></tr></thead>
                    <tbody>
                      {done.map((r) => (
                        <tr key={r.pseudonym}>
                          <td><b>{r.pseudonym}</b></td>
                          <td>{topThemes(r.answers.cards).map((t) => THEMES[t]).join(", ") || "keins"}</td>
                          <td style={{ minWidth: 240 }}>{r.answers.dream}{r.answers.problem && <><br /><span className="faint">Nervt: {r.answers.problem}</span></>}</td>
                          <td style={{ minWidth: 200 }}>
                            <span className="chip">{GOAL_DIRECTIONS.find((g) => g.id === r.answers.goalDirection)?.label}</span><br />{r.answers.goal}
                          </td>
                          <td>{r.share_dream === "name" ? "mit Name" : r.share_dream === "anon" ? "anonym" : "privat"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
