import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { germanDay, loadSession } from "@/lib/sessions";
import { Topbar } from "@/components/Topbar";
import { MaterialList, type Material } from "@/components/MaterialList";
import { togglePublished } from "../actions";
import { DeleteSession, EditSessionForm, LinkForm, TextForm, Uploader } from "../SessionForms";

export const metadata: Metadata = { title: "Sitzung bearbeiten" };
export const dynamic = "force-dynamic";

export default async function CoachSession({ params }: { params: Promise<{ id: string }> }) {
  const coach = await requireCoach();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s) notFound();
  const materials = await sql<Material[]>`
    select id, kind, title, url, body, filename, mime, size::int as size, complete
    from materials where session_id = ${id} order by position, created_at`;
  const [{ notes }] = await sql<{ notes: number }[]>`select count(*)::int as notes from notes where session_id = ${id} and length(body) > 0`;
  const nav = await sql<{ id: string; number: number }[]>`
    select id, number from ag_sessions where group_id = ${s.group_id} order by number`;
  const pos = nav.findIndex((n) => n.id === id);

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 32 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Link href={`/coach/sitzungen?ag=${s.group_id}`}>Alle Sitzungen</Link>
              <span style={{ display: "flex", gap: 14 }}>
                {pos > 0 && <Link href={`/coach/sitzungen/${nav[pos - 1].id}`}>Sitzung {nav[pos - 1].number}</Link>}
                {pos < nav.length - 1 && <Link href={`/coach/sitzungen/${nav[pos + 1].id}`}>Sitzung {nav[pos + 1].number}</Link>}
              </span>
            </div>
            <div className="tags">
              <span className="tag outline">Sitzung {s.number}</span>
              {s.date_label && <span className="tag">{germanDay(s.date_label)}</span>}
              <span className={`tag`}>{s.published ? "veröffentlicht" : "Entwurf, für Teilnehmende unsichtbar"}</span>
            </div>
            <h1>{s.title || `Sitzung ${s.number}`}</h1>
            <div className="head-actions">
              <form action={togglePublished}>
                <input type="hidden" name="id" value={s.id} />
                <button className={`btn${s.published ? " ghost" : ""}`} type="submit">{s.published ? "Wieder verstecken" : "Für Teilnehmende veröffentlichen"}</button>
              </form>
              {s.published && <Link className="btn ghost" href={`/sitzungen/${s.id}`}>So sehen es die Teilnehmenden</Link>}
            </div>
            {notes > 0 && <p className="faint">{notes} {notes === 1 ? "Person hat" : "Personen haben"} Notizen zu dieser Sitzung. Die Notizen sind privat, du siehst nur die Anzahl.</p>}
          </section>

          <section className="card">
            <header><h3>Angaben</h3></header>
            <EditSessionForm s={s} />
          </section>

          <section className="section">
            <h2>Material</h2>
            <MaterialList items={materials} coach />
            <div className="two-col">
              <section className="card">
                <header><h3>Dateien hochladen</h3></header>
                <div className="body"><Uploader sessionId={s.id} /></div>
              </section>
              <section className="card">
                <header><h3>Link hinzufügen</h3></header>
                <div className="body"><LinkForm sessionId={s.id} /></div>
              </section>
            </div>
            <section className="card">
              <header><h3>Text oder Aufgabe hinzufügen</h3></header>
              <div className="body"><TextForm sessionId={s.id} /></div>
            </section>
          </section>

          <div style={{ alignSelf: "flex-start" }}><DeleteSession id={s.id} /></div>
        </div>
      </main>
    </>
  );
}
