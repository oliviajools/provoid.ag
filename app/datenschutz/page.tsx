import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = { title: "Datenschutz" };
export const dynamic = "force-dynamic";

// HINWEIS FÜR PROVOID: Text vor dem Start rechtlich prüfen lassen und die Angaben in [eckigen Klammern] ergänzen.
export default async function Datenschutz() {
  const user = await getUser();
  return (
    <>
      <Topbar pseudonym={user?.pseudonym} home={user ? (user.role === "coach" ? "/coach" : "/start") : "/"} />
      <main>
        <div className="container">
          <article className="prose">
            <h1 style={{ color: "var(--text)" }}>Datenschutz.</h1>
            <p>Kurz gesagt: Wir speichern so wenig wie möglich. Du brauchst keine E-Mail-Adresse und keinen echten Namen.</p>

            <h2>Wer ist verantwortlich?</h2>
            <p>PROVOID, [Name und Anschrift laut Impressum], E-Mail: [Kontaktadresse].</p>

            <h2>Was wird gespeichert?</h2>
            <ul>
              <li>dein Pseudonym und die AG, zu der du gehörst</li>
              <li>dein Passwort, aber nur verschlüsselt als sogenannter Hash. Niemand kann es im Klartext lesen, auch wir nicht.</li>
              <li>wann du dich angemeldet hast und wann du zuletzt eingeloggt warst</li>
              <li>fehlgeschlagene Login-Versuche für höchstens 24 Stunden, um dein Konto vor dem Durchprobieren von Passwörtern zu schützen</li>
            </ul>

            <h2>Wofür?</h2>
            <p>Nur, damit du die Plattform der KI-AG nutzen kannst. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), bei unter 16-Jährigen die Einwilligung der Eltern.</p>

            <h2>Cookies und Tracking</h2>
            <p>Wir setzen genau ein Cookie: das Login-Cookie, damit du eingeloggt bleibst. Es gibt kein Tracking, keine Werbung und keine Analyse-Tools. Schriften werden von unserem eigenen Server geladen, nicht von Google.</p>

            <h2>Wo liegen die Daten?</h2>
            <p>Die Datenbank liegt auf einem Server von Hetzner in Deutschland. Die Website wird über Vercel in der Region Frankfurt ausgeliefert. [Auftragsverarbeitungsverträge mit Hetzner und Vercel ergänzen.]</p>

            <h2>Wie lange?</h2>
            <p>Bis zum Ende der AG. Danach löschen wir die Konten, außer du möchtest dein Portfolio behalten. Auf Wunsch löschen wir dein Konto jederzeit, sag einfach deiner Coach Bescheid.</p>

            <h2>Deine Rechte</h2>
            <p>Du kannst jederzeit Auskunft, Berichtigung oder Löschung verlangen und deine Einwilligung widerrufen. Außerdem kannst du dich beim Hamburgischen Beauftragten für Datenschutz und Informationsfreiheit beschweren.</p>
          </article>
        </div>
      </main>
    </>
  );
}
