import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { Radar } from "@/components/Radar";
import { THEMES, firstMission, topThemes, workStyle, type Answers } from "@/lib/compass";

export const metadata: Metadata = { title: "Deine Kompass-Karte" };
export const dynamic = "force-dynamic";

const SHARE_LABEL = { name: "mit deinem Pseudonym", anon: "anonym", no: "nicht" } as const;

export default async function Karte({ searchParams }: { searchParams: Promise<{ neu?: string }> }) {
  const user = await requireUser();
  const { neu } = await searchParams;
  const row = (await sql<{ answers: Answers; updated: string }[]>`
    select answers, to_char(updated_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') as updated
    from compass where user_id = ${user.id} and round = 1`)[0];
  if (!row) redirect("/kompass");
  const a = row.answers;
  const themes = topThemes(a.cards);
  const style = workStyle(a.pairs);
  const mission = firstMission(themes);

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home="/start" />
      <main>
        <div className="container page" style={{ gap: 40 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags">
                <span className="tag outline">Kompass-Karte</span>
                <span className="tag">Start · {row.updated}</span>
              </div>
              <h1>{neu ? `Geschafft, ${user.pseudonym}.` : `Dein Kompass, ${user.pseudonym}.`}</h1>
              <p className="lead">Das ist dein Ausgangspunkt für die AG. Zur Halbzeit und am Ende schauen wir gemeinsam, wie er sich verändert hat.</p>
              <div className="head-actions">
                <Link className="btn ghost" href="/kompass?bearbeiten=1">Antworten ändern</Link>
                <Link className="btn ghost" href="/ideen">Zur Ideen-Wand</Link>
              </div>
            </div>
          </section>

          <div className="kcard">
            <div className="stack" style={{ gap: 22 }}>
              <section className="card">
                <header><h3>Dein Traumprojekt</h3><span className="chip">{a.share === "no" ? "privat" : "auf der Ideen-Wand"}</span></header>
                <div className="body">
                  <blockquote>{a.dream}</blockquote>
                  {a.problem && <p><b style={{ color: "var(--text)" }}>Was dich nervt:</b> {a.problem}</p>}
                </div>
              </section>

              <section className="card">
                <header><h3>Dein Ziel bis März</h3></header>
                <div className="body">
                  <blockquote>{a.goal}</blockquote>
                  <p>{a.ifthen}.</p>
                </div>
              </section>

              <section className="mission" aria-labelledby="mission">
                <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 700 }}>Deine erste Mission</span>
                <h3 id="mission">{mission.task}</h3>
                <p>
                  Zum Aufwärmen: Schau dir an, wie andere dein Thema angegangen sind, zum Beispiel „{mission.card.title}“.{" "}
                  <a href={mission.card.source} target="_blank" rel="noreferrer">Zum Artikel</a>
                </p>
              </section>
            </div>

            <div className="stack" style={{ gap: 22 }}>
              <section className="card">
                <header><h3>Deine Themenfelder</h3></header>
                <div className="body themes-list">
                  {themes.length === 0 ? (
                    <p>Keine der Karten hat dich gepackt. Vielleicht gibt es dein Thema noch gar nicht, das ist eine gute Nachricht.</p>
                  ) : (
                    <ol>
                      {themes.map((t, i) => (
                        <li key={t}><span className="n">{i + 1}</span><span style={{ color: "var(--text)" }}>{THEMES[t]}</span></li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>

              <section className="card">
                <header><h3>Dein Startpunkt</h3></header>
                <div className="body">
                  <Radar values={a.skills} label="Deine Selbsteinschätzung in sechs Bereichen, jeweils von 1 bis 5" />
                </div>
              </section>

              <section className="card">
                <header><h3>So arbeitest du am liebsten</h3></header>
                <div className="body">
                  <ul className="plain-list">{style.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              </section>
            </div>
          </div>
          <p className="faint">
            Dein Traumprojekt erscheint {SHARE_LABEL[a.share]} auf der Ideen-Wand. Alles andere auf dieser Karte sehen nur du und deine Coach.
          </p>
        </div>
      </main>
    </>
  );
}
