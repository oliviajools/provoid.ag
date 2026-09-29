import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PHASES, canView, germanDay, loadSession } from "@/lib/sessions";
import { Topbar } from "@/components/Topbar";
import { Linkify, MaterialList, type Material } from "@/components/MaterialList";
import { NotesEditor } from "../NotesEditor";

export const metadata: Metadata = { title: "Sitzung" };
export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s || !canView(user, s)) notFound();
  const materials = await sql<Material[]>`
    select id, kind, title, url, body, filename, mime, size::int as size, complete
    from materials where session_id = ${id} and complete order by position, created_at`;
  const note = user.role === "student"
    ? (await sql<{ body: string; at: string }[]>`
        select body, to_char(updated_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as at from notes where user_id = ${user.id} and session_id = ${id}`)[0]
    : undefined;
  const nav = await sql<{ id: string; number: number }[]>`
    select id, number from ag_sessions where group_id = ${s.group_id} ${user.role === "coach" ? sql`` : sql`and published`} order by number`;
  const pos = nav.findIndex((n) => n.id === id);

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container page" style={{ gap: 32 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Link href="/sitzungen">Alle Sitzungen</Link>
              <span style={{ display: "flex", gap: 14 }}>
                {pos > 0 && <Link href={`/sitzungen/${nav[pos - 1].id}`}>Sitzung {nav[pos - 1].number}</Link>}
                {pos < nav.length - 1 && <Link href={`/sitzungen/${nav[pos + 1].id}`}>Sitzung {nav[pos + 1].number}</Link>}
              </span>
            </div>
            <div className="tags">
              <span className="tag outline">Sitzung {s.number}</span>
              {s.date_label && <span className="tag">{germanDay(s.date_label)}</span>}
              {s.phase && <span className="tag">{PHASES[s.phase]}</span>}
            </div>
            <h1>{s.title || `Sitzung ${s.number}`}</h1>
            {s.summary && <p className="lead" style={{ whiteSpace: "pre-line" }}><Linkify text={s.summary} /></p>}
          </section>

          <div className="session-layout">
            <section className="section" style={{ gap: 16 }}>
              <h2>Material</h2>
              <MaterialList items={materials} />
            </section>
            {user.role === "student" && (
              <section className="card notes-card">
                <header><h3>Meine Notizen</h3><span className="chip">nur für dich</span></header>
                <div className="body">
                  <NotesEditor sessionId={id} initial={note?.body ?? ""} updated={note?.at ?? null} />
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
