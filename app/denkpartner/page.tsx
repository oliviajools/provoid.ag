import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { einstellungen, meineDenkpartner, verbrauchtDieseWoche } from "@/lib/denkpartner";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = { title: "Mein Denkpartner" };
export const dynamic = "force-dynamic";

export default async function DenkpartnerListe() {
  const user = await requireUser();
  const { enabled, limit } = await einstellungen(user);
  const liste = await meineDenkpartner(user.id);
  const used = await verbrauchtDieseWoche(user.id);

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={user.role === "coach" ? "/coach" : "/start"} />
      <main>
        <div className="container page" style={{ gap: 40 }}>
          <section className="stack" style={{ gap: 16 }}>
            <div className="tags"><span className="tag">Baukasten</span></div>
            <h1>Dein Denkpartner.</h1>
            <p className="lead">
              Gleiches Modell, andere Anweisung. Hier schreibst du die Anweisung: für eine KI, die dir beim Denken hilft,
              statt dir die Lösung zu verraten. Am besten für deine nächste Klausur.
            </p>
            <div className="meta-row">
              <span>Diese Woche: <b style={{ color: "var(--text)" }}>{used} von {limit}</b> Nachrichten</span>
              <span>Deine Gespräche werden nicht gespeichert.</span>
            </div>
          </section>

          {!enabled ? (
            <div className="alert error" role="status">Der Baukasten ist für deine AG gerade ausgeschaltet. Deine Coach schaltet ihn in der Sitzung frei.</div>
          ) : (
            <div><Link href="/denkpartner/neu" className="btn">+ Neuer Denkpartner</Link></div>
          )}

          <section className="section" aria-labelledby="dp-liste">
            <h2 id="dp-liste">Deine Denkpartner</h2>
            {liste.length === 0 ? (
              <p className="muted">Noch keiner. Fang mit einer Klausur an, die bald ansteht.</p>
            ) : (
              <div className="tiles">
                {liste.map((d) => (
                  <Link href={`/denkpartner/${d.id}`} className="card tile live-tile" key={d.id}>
                    <header><h3>{d.name}</h3>{d.fach && <span className="chip live">{d.fach}</span>}</header>
                    <div className="body">
                      <p>{(d.felder.kontext ?? "").slice(0, 140)}{(d.felder.kontext ?? "").length > 140 ? " …" : ""}</p>
                      <span className="faint">geändert {d.updated}</span>
                      <span className="tile-cta">Öffnen und testen</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
