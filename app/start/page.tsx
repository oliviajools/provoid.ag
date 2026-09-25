import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = { title: "Start" };
export const dynamic = "force-dynamic";

const FEATURES: { href?: string; title: string; when: string; text: string }[] = [
  {
    href: "/kompass",
    title: "Dein Kompass",
    when: "Session 1",
    text: "Eine kurze Befragung. Daraus entstehen dein Ziel für die AG, deine Projektidee und die drei Themen, die dich am meisten interessieren.",
  },
  {
    title: "KI-Radar",
    when: "Jede Session",
    text: "Die wichtigsten KI-News zum Start jeder Session. Mit der Rubrik „Hype oder echt?“, bei der ihr abstimmt.",
  },
  {
    title: "Quellen einreichen",
    when: "Ab Session 2",
    text: "Du findest unter der Woche etwas Spannendes über KI? Reich es ein. Die besten Funde landen im Radar, mit deinem Namen.",
  },
  {
    title: "Mein Projekt",
    when: "Phase Bauen",
    text: "Dein eigenes KI-Projekt, allein oder im Team. Hier planst du es, hältst Fortschritte fest und zeigst es am Ende beim Showcase.",
  },
  {
    title: "Skill-Baum",
    when: "Wächst mit",
    text: "Statt Noten siehst du, was du schon kannst: Prompten, Prüfen, Bauen, Präsentieren. Daraus wird dein Portfolio.",
  },
];

const PHASES = [
  { title: "Durchschauen", text: "Wie funktioniert KI wirklich, und wo liegt sie daneben?" },
  { title: "Einordnen", text: "Was macht KI mit unserem Denken, mit der Gesellschaft und mit dem Planeten?" },
  { title: "Bauen", text: "Jetzt wird es konkret: Du baust ein eigenes Werkzeug oder Projekt mit KI." },
];

export default async function Start() {
  const user = await requireUser();
  const days = user.days_until_start;
  const hasCompass = (await sql`select 1 from compass where user_id = ${user.id} and round = 1`).length > 0;
  const before = days !== null && days > 0;

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container page">
          <section className="welcome">
            <div className="stack" style={{ gap: 18 }}>
              <div className="tags">
                <span className="tag">{user.group_name ?? "Coach-Vorschau"}</span>
                {user.group_school && <span className="tag outline">{user.group_school}</span>}
              </div>
              <h1>Hallo, {user.pseudonym}.</h1>
              <p className="lead">
                Hier entsteht Schritt für Schritt deine AG-Plattform. Starte mit deinem Kompass, die anderen
                Bereiche schalten wir nach und nach frei.
              </p>
            </div>
            {before && (
              <div className="countdown" aria-label={`Noch ${days} Tage bis zum Start`}>
                <div className="big">{days}</div>
                <p className="faint">{days === 1 ? "Tag" : "Tage"} bis zum Start am {user.group_starts_label}</p>
              </div>
            )}
            {days === 0 && (
              <div className="countdown"><div className="big">Heute</div><p className="faint">geht es los.</p></div>
            )}
          </section>

          <section className="section" aria-labelledby="features">
            <div className="stack" style={{ gap: 8 }}>
              <h2 id="features">Das erwartet dich hier.</h2>
              <p className="muted">Jede Funktion bekommt ihren eigenen Bereich. Was noch kommt, ist schon markiert.</p>
            </div>
            <div className="tiles">
              {FEATURES.map((f) => f.href ? (
                <Link href={hasCompass ? "/kompass/karte" : f.href} className="card tile live-tile" key={f.title}>
                  <header><h3>{f.title}</h3><span className="chip live">{hasCompass ? "Ausgefüllt" : "Jetzt starten"}</span></header>
                  <div className="body"><p>{f.text}</p><span className="tile-cta">{hasCompass ? "Deine Kompass-Karte ansehen" : "Kompass starten"}</span></div>
                </Link>
              ) : (
                <article className="card tile" key={f.title}>
                  <header><h3>{f.title}</h3><span className="chip">{f.when}</span></header>
                  <div className="body"><p>{f.text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section className="section" aria-labelledby="phasen">
            <div className="stack" style={{ gap: 8 }}>
              <h2 id="phasen">Dein Weg durch die AG.</h2>
              <p className="muted">Erst verstehen, dann einordnen, dann bauen. Die Werkzeuge kommen bewusst zum Schluss.</p>
            </div>
            <div className="timeline">
              {PHASES.map((p, i) => (
                <div className={`step${i === 0 ? " now" : ""}`} key={p.title}>
                  <div className="n">{i + 1}</div>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
