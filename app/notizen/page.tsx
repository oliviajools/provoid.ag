import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { germanDay } from "@/lib/sessions";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = { title: "Meine Notizen" };
export const dynamic = "force-dynamic";

export default async function Notes() {
  const user = await requireUser();
  const notes = await sql<{ session_id: string; number: number; title: string; date_label: string | null; body: string; at: string }[]>`
    select n.session_id, s.number, s.title, to_char(s.date, 'Dy DD.MM.YYYY') as date_label, n.body,
           to_char(n.updated_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as at
    from notes n join ag_sessions s on s.id = n.session_id
    where n.user_id = ${user.id} and length(n.body) > 0 and s.published
    order by s.number`;
  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container page" style={{ gap: 32 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div className="tags"><span className="tag outline">Meine Notizen</span><span className="tag">{notes.length} Sitzungen</span></div>
            <h1>Alles, was du dir notiert hast.</h1>
            <p className="lead">Deine Notizen aus allen Sitzungen an einem Ort. Nur du kannst sie sehen.</p>
          </section>
          <section className="card">
            <div className="body">
              {notes.length === 0 ? <p className="muted">Noch keine Notizen. Öffne eine <Link href="/sitzungen">Sitzung</Link> und schreib los.</p> : notes.map((n) => (
                <article className="note-item" key={n.session_id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <Link href={`/sitzungen/${n.session_id}`} className="stitle" style={{ textDecoration: "none" }}>
                      Sitzung {n.number}{n.title ? `: ${n.title}` : ""}
                    </Link>
                    <span className="faint">{germanDay(n.date_label)}{n.date_label ? " · " : ""}bearbeitet {n.at}</span>
                  </div>
                  <p className="body-text">{n.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
