import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { listGroups, pickGroup } from "@/lib/groups";
import { AgPicker, AgTag } from "@/components/AgPicker";
import { Topbar } from "@/components/Topbar";
import { einstellen } from "./actions";

export const metadata: Metadata = { title: "Denkpartner" };
export const dynamic = "force-dynamic";

type Row = { id: string; pseudonym: string; name: string; fach: string; updated: string; prompt: string; woche: number };

export default async function CoachDenkpartner({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const coach = await requireCoach();
  const { ag } = await searchParams;
  const groups = await listGroups();
  const group = await pickGroup(groups, ag);
  const [cfg] = group ? await sql<{ dp_enabled: boolean; dp_limit: number }[]>`select dp_enabled, dp_limit from groups where id = ${group.id}` : [];
  const rows = group ? await sql<Row[]>`
    select d.id, u.pseudonym, d.name, d.fach, d.prompt,
           to_char(d.updated_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as updated,
           coalesce((select n from denkpartner_usage x where x.user_id = d.user_id
                     and x.week_start = (date_trunc('week', now() at time zone 'Europe/Berlin'))::date), 0)::int as woche
    from denkpartner d join users u on u.id = d.user_id
    where d.group_id = ${group.id}
    order by u.pseudonym_lower, d.updated_at desc` : [];
  const personen = new Set(rows.map((r) => r.pseudonym)).size;
  const [{ n: mitglieder }] = group
    ? await sql<{ n: number }[]>`select count(*)::int as n from users where group_id = ${group.id} and role = 'student' and disabled = false`
    : [{ n: 0 }];

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 40 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div className="tags"><span className="tag outline">Coach-Bereich</span><AgTag g={group} /></div>
            <h1>Denkpartner.</h1>
            <p className="lead">
              {personen} von {mitglieder} haben einen Denkpartner gebaut. Du siehst die Anweisungen, aber keine Gespräche:
              Die werden nicht gespeichert, nur gezählt.
            </p>
            <AgPicker groups={groups} current={group} next="/coach/denkpartner" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/denkpartner" className="btn ghost">Eigenen Denkpartner bauen (für die Live-Demo)</Link>
            </div>
          </section>

          {group && cfg && (
            <section className="card" aria-labelledby="dp-cfg">
              <header><h3 id="dp-cfg">Einstellungen für diese AG</h3></header>
              <form action={einstellen} className="body">
                <input type="hidden" name="group_id" value={group.id} />
                <label className="check"><input type="checkbox" name="enabled" defaultChecked={cfg.dp_enabled} />
                  <span>Baukasten eingeschaltet: Die Teilnehmenden können Denkpartner bauen und testen.</span></label>
                <div className="field" style={{ maxWidth: 280 }}>
                  <label htmlFor="dp-limit">Nachrichten pro Person und Woche</label>
                  <input id="dp-limit" name="limit" type="number" min={0} max={500} defaultValue={cfg.dp_limit} />
                  <span className="hint">Jede Nachricht kostet API-Guthaben. 60 reichen für eine Sitzung und Üben zu Hause.</span>
                </div>
                <div><button className="btn small" type="submit">Speichern</button></div>
              </form>
            </section>
          )}

          <section className="section" aria-labelledby="dp-alle">
            <h2 id="dp-alle">Alle Denkpartner der AG</h2>
            {rows.length === 0 ? <p className="muted">Noch keine.</p> : (
              <div className="table-wrap">
                <table >
                  <thead><tr><th>Pseudonym</th><th>Denkpartner</th><th>Fach</th><th>Geändert</th><th>Nachrichten diese Woche</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.pseudonym}</td>
                        <td>
                          <details><summary>{r.name}</summary><pre className="dp-prompt" style={{ marginTop: 10 }}>{r.prompt}</pre></details>
                        </td>
                        <td>{r.fach}</td>
                        <td>{r.updated}</td>
                        <td>{r.woche}</td>
                        <td><Link href={`/denkpartner/${r.id}`} className="btn ghost small">Testen</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
