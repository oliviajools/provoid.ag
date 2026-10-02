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
            <p>PROVOID, Olivia Bahr, Eppendorfer Landstraße 15, Hamburg, E-Mail: [Kontaktadresse].</p>

            <h2>Was wird gespeichert?</h2>
            <ul>
              <li>dein Pseudonym und die AG, zu der du gehörst</li>
              <li>dein Passwort, aber nur verschlüsselt als sogenannter Hash. Niemand kann es im Klartext lesen, auch wir nicht.</li>
              <li>wann du dich angemeldet hast und wann du zuletzt eingeloggt warst</li>
              <li>fehlgeschlagene Login-Versuche für höchstens 24 Stunden, um dein Konto vor dem Durchprobieren von Passwörtern zu schützen</li>
              <li>deine Antworten im Kompass. Sie sehen nur du und deine Coach, außer dein Traumprojekt, wenn du es für die Ideen-Wand freigibst</li>
              <li>Links, die du im KI-Radar einreichst, mit deinem Kommentar und Quellen-Check, sowie deine Reaktionen auf Meldungen. Reaktionen werden nur als Gesamtzahl angezeigt</li>
              <li>Themenwünsche, die du einträgst, und deine Stimmen dafür. Wünsche sehen alle aus deiner AG, mit deinem Pseudonym oder anonym, wie du es wählst</li>
              <li>Fragen, die du vorab an Gäste schickst. Sie sieht nur deine Coach</li>
              <li>deine Notizen zu den Sitzungen. Sie sind privat: Auch deine Coach sieht nur, dass es Notizen gibt, nicht was drinsteht</li>
            </ul>

            <h2>Wofür?</h2>
            <p>Nur, damit du die Plattform der KI-AG nutzen kannst. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), bei unter 16-Jährigen die Einwilligung der Eltern.</p>

            <h2>Cookies und Tracking</h2>
            <p>Wir setzen genau ein Cookie: das Login-Cookie, damit du eingeloggt bleibst. Es gibt kein Tracking, keine Werbung und keine Analyse-Tools. Schriften werden von unserem eigenen Server geladen, nicht von Google.</p>

            <h2>KI-Aufbereitung von Nachrichten</h2>
            <p>Damit Nachrichten im KI-Radar leicht verständlich sind, schickt die Plattform den Text eines öffentlichen Artikels an einen KI-Dienst (Anthropic), der daraus eine kurze Karte schreibt. Dabei werden keine Daten über dich übertragen, nur der Artikeltext und gegebenenfalls der Kommentar zur Einreichung ohne Namen. Jede Karte wird von deiner Coach geprüft.</p>

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
