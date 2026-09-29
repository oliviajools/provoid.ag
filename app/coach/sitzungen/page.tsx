import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { PHASES, germanDay, type Phase } from "@/lib/sessions";
import { Topbar } from "@/components/Topbar";
import { NewSessionForm, SeriesForm } from "./SessionForms";

export const metadata: Metadata = { title: "Sitzungen" };
export const dynamic = "force-dynamic";

type Row = { id: string; number: number; title: string; date_label: string | null; phase: Phase | null; published: boolean; materials: number; notes: number; past: boolean };

export default async function CoachSessions({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const coach = await requireCoach();
  const { ag } = await searchParams;
  const groups = await sql<{ id: string; name: string; starts: string | null }[]>`
    select id, name, to_char(starts_on, 'YYYY-MM-DD') as starts from groups order by created_at desc`;
  const group = groups.find((g) => g.id === ag) ?? groups[0];
  const rows = group ? await sql<Row[]>`
    select s.id, s.number, s.title, s.phase, s.published, to_char(s.date, 'Dy DD.MM.YYYY') as date_label,
           (s.date < (now() at time zone 'Europe/Berlin')::date) as past,
           (select count(*)::int from materials m where m.session_id = s.id and m.complete) as materials,
           (select count(*)::int from notes n where n.session_id = s.id and length(n.body) > 0) as notes
    from ag_sessions s where s.group_id = ${group.id} order by s.number, s.date` : [];

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 40 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Sitzungen und Material</span>{group && <span className="tag">{group.name}</span>}</div>
              <h1>Material zum Vertiefen.</h1>
              <p className="lead">Lege die Sitzungen an und häng Folien, Links und Aufgaben dran. Die Teilnehmenden sehen nur veröffentlichte Sitzungen und schreiben dort ihre eigenen Notizen.</p>
            </div>
            {groups.length > 1 && (
              <form style={{ display: "flex", gap: 8 }}>
                <select name="ag" defaultValue={group?.id} className="select" aria-label="AG wählen">
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="btn ghost small" type="submit">Anzeigen</button>
              </form>
            )}
          </section>

          {!group ? <p className="muted">Leg zuerst im Coach-Bereich eine AG an.</p> : (
            <>
              <section className="card">
                <header><h3>Sitzungen</h3><span className="chip">{rows.filter((r) => r.published).length} von {rows.length} veröffentlicht</span></header>
                <div className="body">
                  {rows.length === 0 ? <p className="muted">Noch keine Sitzungen. Leg unten eine einzelne an oder gleich die ganze Serie.</p> : (
                    <div className="sessions-list">
                      {rows.map((r) => (
                        <Link href={`/coach/sitzungen/${r.id}`} className={`srow${r.published ? "" : " draft"}`} key={r.id}>
                          <span className="snum">{r.number}</span>
                          <div className="stack" style={{ gap: 2 }}>
                            <span className="stitle">{r.title || `Sitzung ${r.number}`}</span>
                            <span className="smeta">
                              {r.date_label && <span>{germanDay(r.date_label)}</span>}
                              {r.phase && <span>{PHASES[r.phase]}</span>}
                              <span>{r.materials} Material</span>
                              {r.notes > 0 && <span>{r.notes} mit Notizen</span>}
                            </span>
                          </div>
                          <div className="schips">
                            <span className={`status-pill ${r.published ? "published" : ""}`}>{r.published ? "veröffentlicht" : "Entwurf"}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className="two-col">
                <section className="card">
                  <header><h3>Einzelne Sitzung anlegen</h3></header>
                  <div className="body"><NewSessionForm groupId={group.id} /></div>
                </section>
                <section className="card">
                  <header><h3>Ganze Serie anlegen</h3></header>
                  <div className="body">
                    <p className="faint">Legt nummerierte Sitzungen im gleichen Abstand an. Titel und Termine in den Ferien passt du danach einzeln an.</p>
                    <SeriesForm groupId={group.id} defaultFirst={group.starts ?? ""} />
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
