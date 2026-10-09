import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextGuest } from "@/lib/guests";
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
    href: "/sitzungen",
    title: "Sitzungen und Material",
    when: "Jede Session",
    text: "Folien, Links und Aufgaben aus jeder Sitzung zum Nachlesen und Vertiefen. Dazu deine eigenen Notizen, die nur du siehst.",
  },
  {
    href: "/themen",
    title: "Themenwünsche",
    when: "Jederzeit",
    text: "Was interessiert dich an KI? Trag Themen ein und stimm bei den Wünschen der anderen ab. Was viele wollen, kommt in die AG.",
  },
  {
    href: "/gaeste",
    title: "Gäste",
    when: "Angekündigt",
    text: "Wer die AG besuchen kommt. Schick vorab deine Fragen, deine Coach bringt sie mit in den Besuch.",
  },
  {
    href: "/radar",
    title: "KI-Radar",
    when: "Jede Session",
    text: "Die wichtigsten KI-News zum Start jeder Session. Mit der Rubrik „Hype oder echt?“, bei der ihr abstimmt.",
  },
  {
    href: "/radar/einreichen",
    title: "Quellen einreichen",
    when: "Jederzeit",
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
  // QR-Code zur Anmeldung nur für die Gruppe am Gymnasium Eppendorf (und für Coaches)
  const showQr = user.role === "coach" || /epp/i.test(`${user.group_school ?? ""} ${user.group_name ?? ""}`);
  const days = user.days_until_start;
  const [{ n: radarCount }] = await sql<{ n: number }[]>`
    select count(*)::int as n from news_items where status = 'published' and (group_id is null or group_id = ${user.group_id})
      and published_at > now() - make_interval(days => ${Number(process.env.RADAR_DAYS ?? 14)})`;
  const [{ n: sessionCount }] = await sql<{ n: number }[]>`
    select count(*)::int as n from ag_sessions where published and group_id = ${user.group_id}`;
  const [{ n: wishCount }] = await sql<{ n: number }[]>`
    select count(*)::int as n from topic_wishes where group_id = ${user.group_id} and status in ('open', 'planned')`;
  const guest = await nextGuest(user.group_id);
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
                Hier findest du alles rund um die AG: deinen Kompass, das Material aus den Sitzungen, die neuesten
                KI-Meldungen und wer uns als Nächstes besuchen kommt.
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

          {guest && (
            <Link href={`/gaeste#gast-${guest.id}`} className="guest-banner">
              <div className="stack" style={{ gap: 4 }}>
                <span className="label">Nächster Gast · {guest.weekday} {guest.day}. {guest.month}{guest.time_label ? `, ${guest.time_label}` : ""}</span>
                <b>{guest.name}</b>
                <span className="muted">{[guest.role, guest.topic].filter(Boolean).join(" · ")}</span>
              </div>
              <span className="btn ghost small">{guest.questions_open ? "Frage vorab schicken" : "Mehr erfahren"}</span>
            </Link>
          )}

          <section className="section" aria-labelledby="features">
            <div className="stack" style={{ gap: 8 }}>
              <h2 id="features">Das erwartet dich hier.</h2>
              <p className="muted">Deine Bereiche auf einen Blick.</p>
            </div>
            <div className="tiles">
              {FEATURES.map((f) => f.href === "/kompass" ? (
                <Link href={hasCompass ? "/kompass/karte" : f.href} className="card tile live-tile" key={f.title}>
                  <header><h3>{f.title}</h3><span className="chip live">{hasCompass ? "Ausgefüllt" : "Jetzt starten"}</span></header>
                  <div className="body"><p>{f.text}</p><span className="tile-cta">{hasCompass ? "Deine Kompass-Karte ansehen" : "Kompass starten"}</span></div>
                </Link>
              ) : f.href ? (
                <Link href={f.href} className="card tile live-tile" key={f.title}>
                  <header><h3>{f.title}</h3><span className="chip live">{f.href === "/radar" ? `${radarCount} ${radarCount === 1 ? "Meldung" : "Meldungen"}` : f.href === "/sitzungen" ? `${sessionCount} ${sessionCount === 1 ? "Sitzung" : "Sitzungen"}` : f.href === "/themen" ? `${wishCount} ${wishCount === 1 ? "Wunsch" : "Wünsche"}` : f.href === "/gaeste" ? (guest ? `nächster am ${guest.day}.${guest.month ? " " + guest.month : ""}` : "bald") : "Offen"}</span></header>
                  <div className="body"><p>{f.text}</p><span className="tile-cta">{f.href === "/radar" ? "Radar öffnen" : f.href === "/sitzungen" ? "Zu den Sitzungen" : f.href === "/themen" ? "Thema eintragen" : f.href === "/gaeste" ? "Gäste ansehen" : "Quelle einreichen"}</span></div>
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

          {showQr && <section className="section qr-invite" aria-labelledby="einladen">
            <div className="qr-box">
              <img src="/qr-anmeldung-gymepp.png" alt="QR-Code zur Anmeldung für die KI-AG am Gymnasium Eppendorf" width={180} height={180} />
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <h2 id="einladen">Bring deine Leute mit.</h2>
              <p className="muted">Freundinnen und Freunde, die auch mitmachen wollen, scannen einfach den Code. Er führt zur Anmeldung, die ihre Eltern ausfüllen.</p>
              <p><a href="/anmeldung/gymepp">ag.provoid.de/anmeldung/gymepp</a></p>
            </div>
          </section>}
        </div>
      </main>
    </>
  );
}
