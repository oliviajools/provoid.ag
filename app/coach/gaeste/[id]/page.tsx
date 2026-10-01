import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { loadGuests } from "@/lib/guests";
import { Topbar } from "@/components/Topbar";
import { deleteGuest, deleteQuestion, guestToggle } from "../actions";
import { GuestForm } from "../GuestForm";

export const metadata: Metadata = { title: "Gast bearbeiten" };
export const dynamic = "force-dynamic";

export default async function EditGuest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const coach = await requireCoach();
  const { id } = await params;
  const { neu } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await sql<{ group_id: string }[]>`select group_id from guests where id = ${id}`;
  if (!row) notFound();
  const [g] = await loadGuests({ groupId: row.group_id, onlyPublished: false, id });
  const sessions = await sql<{ id: string; number: number; title: string; d: string | null }[]>`
    select id, number, title, to_char(date, 'DD.MM.') as d from ag_sessions where group_id = ${row.group_id} order by number`;
  const questions = await sql<{ id: string; body: string; author: string | null; at: string }[]>`
    select q.id, q.body, u.pseudonym as author, to_char(q.created_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as at
    from guest_questions q left join users u on u.id = q.user_id where q.guest_id = ${id} order by q.created_at`;

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 30 }}>
          <section className="stack" style={{ gap: 14 }}>
            <Link href={`/coach/gaeste?ag=${row.group_id}`}>Alle Gäste</Link>
            <div className="tags">
              <span className="tag outline">Gast</span>
              <span className="tag">{g.published ? "angekündigt" : "Entwurf, für Teilnehmende unsichtbar"}</span>
            </div>
            <h1>{g.name}</h1>
            {neu && !g.published && <div className="alert ok">Gast angelegt. Wenn alles passt, kündige ihn an.</div>}
            <div className="head-actions">
              <form action={guestToggle}><input type="hidden" name="id" value={id} /><input type="hidden" name="field" value="published" />
                <button className={`btn${g.published ? " ghost" : ""}`} type="submit">{g.published ? "Wieder verstecken" : "Für Teilnehmende ankündigen"}</button></form>
              <form action={guestToggle}><input type="hidden" name="id" value={id} /><input type="hidden" name="field" value="questions" />
                <button className="btn ghost" type="submit">{g.questions_open ? "Fragen schließen" : "Fragen wieder öffnen"}</button></form>
              {g.published && <Link className="btn ghost" href={`/gaeste#gast-${id}`}>So sehen es die Teilnehmenden</Link>}
            </div>
          </section>

          <section className="card">
            <header><h3>Fragen der Teilnehmenden</h3><span className="chip">{questions.length} · nur für dich sichtbar</span></header>
            <div className="body">
              {questions.length === 0 ? <p className="muted">{g.questions_open ? "Noch keine Fragen. Die Teilnehmenden können Fragen stellen, sobald der Gast angekündigt ist." : "Fragen sind geschlossen."}</p> : (
                <div className="questions">
                  {questions.map((q) => (
                    <div className="question" key={q.id}>
                      <span><b style={{ color: "var(--accent)" }}>{q.author ?? "gelöscht"}:</b> {q.body}</span>
                      <form action={deleteQuestion}><input type="hidden" name="id" value={q.id} />
                        <button className="linkish" type="submit" style={{ padding: 0 }}>Löschen</button></form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <header><h3>Angaben</h3></header>
            <GuestForm groupId={row.group_id} g={g} sessions={sessions.map((s) => ({ id: s.id, label: `Sitzung ${s.number}${s.d ? ` (${s.d})` : ""}${s.title ? `: ${s.title}` : ""}` }))} />
          </section>

          <form action={deleteGuest} style={{ alignSelf: "flex-start" }}>
            <input type="hidden" name="id" value={id} />
            <button className="linkish" type="submit">Gast löschen (mit allen Fragen)</button>
          </form>
        </div>
      </main>
    </>
  );
}
