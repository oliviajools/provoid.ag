import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PHASES, germanDay, type Phase } from "@/lib/sessions";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = { title: "Sitzungen" };
export const dynamic = "force-dynamic";

type Row = { id: string; number: number; title: string; date_label: string | null; phase: Phase | null; past: boolean | null; materials: number; has_note: boolean };

export default async function Sessions() {
  const user = await requireUser();
  const rows = user.role === "coach" ? [] : await sql<Row[]>`
    select s.id, s.number, s.title, s.phase, to_char(s.date, 'Dy DD.MM.YYYY') as date_label,
           (s.date < (now() at time zone 'Europe/Berlin')::date) as past,
           (select count(*)::int from materials m where m.session_id = s.id and m.complete) as materials,
           exists (select 1 from notes n where n.session_id = s.id and n.user_id = ${user.id} and length(n.body) > 0) as has_note
    from ag_sessions s where s.group_id = ${user.group_id} and s.published
    order by s.number`;
  const next = rows.find((r) => r.past === false);

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Sitzungen</span><span className="tag">{rows.length} mit Material</span></div>
              <h1>Zum Nachlesen und Weiterdenken.</h1>
              <p className="lead">Hier findest du das Material aus jeder Sitzung. Zu jeder Sitzung kannst du dir eigene Notizen machen. Die sieht nur du.</p>
            </div>
            <Link className="btn ghost" href="/notizen">Alle meine Notizen</Link>
          </section>
          {user.role === "coach" && <p className="muted">Als Coach verwaltest du die Sitzungen unter <Link href="/coach/sitzungen">Coach, Sitzungen</Link>.</p>}
          {user.role !== "coach" && (rows.length === 0 ? <p className="muted">Sobald deine Coach Material freigibt, erscheinen die Sitzungen hier.</p> : (
            <section className="card">
              <div className="body sessions-list">
                {rows.map((r) => (
                  <Link href={`/sitzungen/${r.id}`} className={`srow${next?.id === r.id ? " next" : ""}`} key={r.id}>
                    <span className="snum">{r.number}</span>
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="stitle">{r.title || `Sitzung ${r.number}`}</span>
                      <span className="smeta">
                        {r.date_label && <span>{germanDay(r.date_label)}</span>}
                        {r.phase && <span>{PHASES[r.phase]}</span>}
                        <span>{r.materials} Material</span>
                      </span>
                    </div>
                    <div className="schips">
                      {next?.id === r.id && <span className="chip live">Nächste Sitzung</span>}
                      {r.has_note && <span className="chip">Notiz</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
