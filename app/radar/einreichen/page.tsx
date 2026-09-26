import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { SubmitForm } from "./SubmitForm";

export const metadata: Metadata = { title: "Quelle einreichen" };
export const dynamic = "force-dynamic";

const STATUS = { pending: "wird geprüft", published: "im Radar", rejected: "diesmal nicht", hidden: "ausgeblendet" } as const;

export default async function Einreichen() {
  const user = await requireUser();
  const mine = await sql<{ id: string; url: string; kid_note: string; status: keyof typeof STATUS; reject_reason: string; created: string; headline: string | null }[]>`
    select id, url, kid_note, status, reject_reason, card->>'headline' as headline,
           to_char(created_at at time zone 'Europe/Berlin', 'DD.MM.') as created
    from news_items where submitted_by = ${user.id} order by created_at desc limit 30`;
  const published = mine.filter((m) => m.status === "published").length;

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div className="tags"><span className="tag outline">KI-Radar</span><span className="tag">Quelle einreichen</span></div>
            <h1>Du hast was gefunden?</h1>
            <p className="lead">
              Reich es ein. Deine Coach prüft die Quelle, und wenn sie passt, wird daraus eine Karte im KI-Radar, mit
              deinem Namen dran.
            </p>
          </section>
          <div className="submit-grid">
            <section className="card">
              <header><h3>Neue Quelle</h3></header>
              {user.role === "student" ? <SubmitForm /> : <div className="body"><p className="muted">Als Coach legst du Meldungen im Coach-Bereich an.</p></div>}
            </section>
            <section className="card">
              <header><h3>Deine Einreichungen</h3>{published > 0 && <span className="chip live">{published} im Radar</span>}</header>
              <div className="body subs">
                {mine.length === 0 && <p className="muted">Noch nichts eingereicht. Deine erste Mission aus dem Kompass ist ein guter Anfang.</p>}
                {mine.map((m) => (
                  <div className="sub" key={m.id}>
                    <div className="top">
                      <b style={{ color: "var(--text)" }}>{m.headline ?? m.kid_note.slice(0, 90)}</b>
                      <span className={`status-pill ${m.status}`}>{STATUS[m.status]}</span>
                    </div>
                    <a href={m.url} target="_blank" rel="noreferrer">{m.url}</a>
                    <span className="faint">eingereicht am {m.created}</span>
                    {m.status === "rejected" && m.reject_reason && <p className="faint" style={{ color: "var(--muted)" }}>Feedback: {m.reject_reason}</p>}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <p><Link href="/radar">Zurück zum KI-Radar</Link></p>
        </div>
      </main>
    </>
  );
}
