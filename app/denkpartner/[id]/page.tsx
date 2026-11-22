import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { darfBearbeiten, darfSehen, einstellungen, ladeDenkpartner, verbrauchtDieseWoche } from "@/lib/denkpartner";
import { Topbar } from "@/components/Topbar";
import { Editor } from "../Editor";
import { Chat } from "../Chat";
import { loeschen } from "../actions";

export const metadata: Metadata = { title: "Denkpartner" };
export const dynamic = "force-dynamic";

export default async function DenkpartnerSeite({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { neu } = await searchParams;
  const { enabled, limit } = await einstellungen(user);
  const used = await verbrauchtDieseWoche(user.id);
  const home = user.role === "coach" ? "/coach" : "/start";

  if (id === "neu") {
    const [g] = user.group_id ? await sql<{ cohort: string }[]>`select cohort from groups where id = ${user.group_id}` : [];
    return (
      <>
        <Topbar pseudonym={user.pseudonym} home={home} />
        <main>
          <div className="container page" style={{ gap: 32 }}>
            <section className="stack" style={{ gap: 12 }}>
              <Link href="/denkpartner" className="faint">← Deine Denkpartner</Link>
              <h1>Neuer Denkpartner.</h1>
              <p className="lead">Sechs Bausteine. Erst denken, dann tippen. Unten siehst du sofort die fertige Anweisung.</p>
            </section>
            {enabled
              ? <Editor jahrgangVorschlag={(g?.cohort ?? "").replace(/^Jg\.\s*/, "")} />
              : <div className="alert error">Der Baukasten ist für deine AG gerade ausgeschaltet.</div>}
          </div>
        </main>
      </>
    );
  }

  const d = await ladeDenkpartner(id);
  if (!d || !darfSehen(user, d)) notFound();
  const eigen = darfBearbeiten(user, d);
  const [owner] = !eigen ? await sql<{ pseudonym: string }[]>`select pseudonym from users where id = ${d.user_id}` : [];

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={home} />
      <main>
        <div className="container page" style={{ gap: 32 }}>
          <section className="stack" style={{ gap: 12 }}>
            <Link href={eigen ? "/denkpartner" : "/coach/denkpartner"} className="faint">← {eigen ? "Deine Denkpartner" : "Alle Denkpartner der AG"}</Link>
            <div className="tags">
              {d.fach && <span className="tag">{d.fach}</span>}
              {d.jahrgang && <span className="tag outline">Jg. {d.jahrgang}</span>}
              {!eigen && owner && <span className="tag outline">von {owner.pseudonym}</span>}
            </div>
            <h1>{d.name}</h1>
          </section>

          {neu && <div className="alert ok" role="status">Gespeichert. Jetzt testen: Stell ihm eine echte Aufgabe aus deinem Heft.</div>}

          <section id="chat" className="section" aria-labelledby="chat-h" style={{ gap: 16, scrollMarginTop: 20 }}>
            <div className="stack" style={{ gap: 6 }}>
              <h2 id="chat-h">Testen</h2>
              <p className="muted">Versuch ruhig, ihm die Lösung zu entlocken. Wenn er nachgibt, verbesser die Bausteine oben.</p>
            </div>
            {enabled
              ? <Chat id={d.id} limit={limit} used={used} />
              : <div className="alert error">Der Baukasten ist für deine AG gerade ausgeschaltet.</div>}
          </section>

          {eigen ? (
            <section className="section" aria-labelledby="bau-h" style={{ gap: 16 }}>
              <h2 id="bau-h">Bausteine bearbeiten</h2>
              <Editor dp={{ id: d.id, name: d.name, fach: d.fach, jahrgang: d.jahrgang, felder: d.felder }} offen={false} />
              <form action={loeschen}>
                <input type="hidden" name="id" value={d.id} />
                <button className="linkish" type="submit" style={{ padding: 0 }}>Diesen Denkpartner löschen</button>
              </form>
            </section>
          ) : (
            <section className="card" aria-labelledby="prompt-h">
              <header><h3 id="prompt-h">Anweisung</h3></header>
              <div className="body"><pre className="dp-prompt">{d.prompt}</pre></div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
