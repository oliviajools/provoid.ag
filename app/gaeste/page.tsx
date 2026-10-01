import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadGuests } from "@/lib/guests";
import { Topbar } from "@/components/Topbar";
import { GuestCard } from "@/components/GuestCard";
import { deleteMyQuestion } from "./actions";
import { AskForm } from "./AskForm";

export const metadata: Metadata = { title: "Gäste" };
export const dynamic = "force-dynamic";

export default async function Guests() {
  const user = await requireUser();
  if (user.role === "coach") {
    return (
      <>
        <Topbar pseudonym={user.pseudonym} home="/coach" label="Coach" />
        <main><div className="container"><p className="muted">Als Coach verwaltest du Gäste unter <Link href="/coach/gaeste">Coach, Gäste</Link>.</p></div></main>
      </>
    );
  }
  const guests = user.group_id ? await loadGuests({ groupId: user.group_id, onlyPublished: true }) : [];
  const mine = guests.length ? await sql<{ id: string; guest_id: string; body: string }[]>`
    select id, guest_id, body from guest_questions where user_id = ${user.id} and guest_id in ${sql(guests.map((g) => g.id))} order by created_at` : [];
  const upcoming = guests.filter((g) => g.upcoming);
  const past = guests.filter((g) => !g.upcoming);

  const Body = ({ g }: { g: (typeof guests)[number] }) => {
    const qs = mine.filter((q) => q.guest_id === g.id);
    return (
      <div className="stack" style={{ gap: 12, marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        {qs.length > 0 && (
          <div className="questions">
            <span className="faint">Deine Fragen</span>
            {qs.map((q) => (
              <div className="question" key={q.id}>
                <span>{q.body}</span>
                {g.upcoming && <form action={deleteMyQuestion}><input type="hidden" name="id" value={q.id} /><button className="linkish" type="submit" style={{ padding: 0 }}>Löschen</button></form>}
              </div>
            ))}
          </div>
        )}
        {g.upcoming && g.questions_open && qs.length < 3 && <AskForm guestId={g.id} name={g.name} />}
        {g.upcoming && !g.questions_open && <p className="faint">Fragen sind geschlossen. Den Rest fragst du beim Besuch selbst!</p>}
      </div>
    );
  };

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home="/start" />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div className="tags"><span className="tag outline">Gäste</span><span className="tag">{upcoming.length} angekündigt</span></div>
            <h1>Wer uns besuchen kommt.</h1>
            <p className="lead">Menschen, die mit KI arbeiten, forschen oder darüber streiten. Schick vorab deine Fragen, deine Coach bringt sie mit in den Besuch.</p>
          </section>
          <section className="stack" style={{ gap: 18 }}>
            {upcoming.length === 0 ? <p className="muted">Gerade ist kein Gast angekündigt. Hast du eine Idee, wen wir einladen sollten? Trag sie bei den <Link href="/themen">Themenwünschen</Link> ein.</p>
              : upcoming.map((g, i) => <GuestCard g={g} key={g.id} next={i === 0 && !!g.date_iso} sessionHref={g.session_id && g.session_published ? `/sitzungen/${g.session_id}` : undefined}><Body g={g} /></GuestCard>)}
          </section>
          {past.length > 0 && (
            <details className="stack">
              <summary className="faint" style={{ cursor: "pointer" }}>Wer schon da war ({past.length})</summary>
              <div className="stack" style={{ gap: 18, marginTop: 16 }}>
                {past.map((g) => <GuestCard g={g} key={g.id} sessionHref={g.session_id && g.session_published ? `/sitzungen/${g.session_id}` : undefined}><Body g={g} /></GuestCard>)}
              </div>
            </details>
          )}
        </div>
      </main>
    </>
  );
}
