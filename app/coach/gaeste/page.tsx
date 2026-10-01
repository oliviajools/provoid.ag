import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { loadGuests } from "@/lib/guests";
import { Topbar } from "@/components/Topbar";
import { GuestCard } from "@/components/GuestCard";
import { guestToggle } from "./actions";
import { GuestForm } from "./GuestForm";

export const metadata: Metadata = { title: "Gäste" };
export const dynamic = "force-dynamic";

export default async function CoachGuests({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const coach = await requireCoach();
  const { ag } = await searchParams;
  const groups = await sql<{ id: string; name: string }[]>`select id, name from groups order by created_at desc`;
  const group = groups.find((g) => g.id === ag) ?? groups[0];
  const guests = group ? await loadGuests({ groupId: group.id, onlyPublished: false }) : [];
  const sessions = group ? await sql<{ id: string; number: number; title: string; d: string | null }[]>`
    select id, number, title, to_char(date, 'DD.MM.') as d from ag_sessions where group_id = ${group.id} order by number` : [];
  const upcoming = guests.filter((g) => g.upcoming);
  const past = guests.filter((g) => !g.upcoming);

  const Actions = ({ id, published, questions }: { id: string; published: boolean; questions: number }) => (
    <div className="qactions" style={{ marginTop: 6 }}>
      <Link className="btn small" href={`/coach/gaeste/${id}`}>Bearbeiten{questions ? ` · ${questions} ${questions === 1 ? "Frage" : "Fragen"}` : ""}</Link>
      <form action={guestToggle}><input type="hidden" name="id" value={id} /><input type="hidden" name="field" value="published" />
        <button className="btn ghost small" type="submit">{published ? "Verstecken" : "Ankündigen"}</button></form>
      <span className={`status-pill ${published ? "published" : ""}`}>{published ? "angekündigt" : "Entwurf"}</span>
    </div>
  );

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Gäste</span>{group && <span className="tag">{group.name}</span>}</div>
              <h1>Wer besucht die AG?</h1>
              <p className="lead">Kündige Gäste an, sobald sie zugesagt haben. Die Teilnehmenden können vorab Fragen schicken, die nur du siehst.</p>
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
          {!group ? <p className="muted">Leg zuerst eine AG an.</p> : (
            <>
              <section className="stack" style={{ gap: 16 }}>
                <h2>Kommende Gäste</h2>
                {upcoming.length === 0 ? <p className="muted">Noch keine Gäste geplant.</p> : upcoming.map((g, i) => (
                  <GuestCard g={g} key={g.id} next={i === 0 && g.published && !!g.date_iso}>
                    <Actions id={g.id} published={g.published} questions={g.questions} />
                  </GuestCard>
                ))}
              </section>
              <section className="card">
                <header><h3>Neuen Gast anlegen</h3></header>
                <GuestForm groupId={group.id} sessions={sessions.map((s) => ({ id: s.id, label: `Sitzung ${s.number}${s.d ? ` (${s.d})` : ""}${s.title ? `: ${s.title}` : ""}` }))} />
              </section>
              {past.length > 0 && (
                <details className="stack" style={{ gap: 16 }}>
                  <summary className="faint" style={{ cursor: "pointer" }}>Vergangene Besuche ({past.length})</summary>
                  <div className="stack" style={{ gap: 16, marginTop: 16 }}>
                    {past.map((g) => <GuestCard g={g} key={g.id}><Actions id={g.id} published={g.published} questions={g.questions} /></GuestCard>)}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
