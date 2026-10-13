import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { germanDay, loadSession } from "@/lib/sessions";
import { Topbar } from "@/components/Topbar";
import { MaterialList, type Material } from "@/components/MaterialList";
import { togglePublished } from "../actions";
import { DeleteSession, EditSessionForm, LinkForm, TextForm, Uploader } from "../SessionForms";
import { KIND_LABEL, TEMPLATES, liveSlide, loadItems, type LiveItem } from "@/lib/live";
import { liveItemOp, stopLive } from "../live-actions";
import { DeckUpload, LiveItemForm, TemplateForm } from "../LiveForms";

function slideInfo(i: LiveItem) {
  const parts: string[] = [];
  if (i.slide !== null) parts.push(i.until_slide && i.until_slide !== i.slide ? `Folie ${i.slide} bis ${i.until_slide}` : `Folie ${i.slide}`);
  if (i.reveal_slide !== null) parts.push(`Auflösung Folie ${i.reveal_slide}`);
  if (i.homework) parts.push(i.closed ? "Hausaufgabe, geschlossen" : "Hausaufgabe, offen");
  return parts.join(" · ") || "ohne Folie";
}

function ItemOp({ id, op, label, ghost = true }: { id: string; op: string; label: string; ghost?: boolean }) {
  return (
    <form action={liveItemOp}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} />
      <button className={ghost ? "btn ghost small" : "linkish"} type="submit" style={ghost ? undefined : { padding: 0 }}>{label}</button></form>
  );
}

export const metadata: Metadata = { title: "Sitzung bearbeiten" };
export const dynamic = "force-dynamic";

export default async function CoachSession({ params }: { params: Promise<{ id: string }> }) {
  const coach = await requireCoach();
  const { id } = await params;
  const s = await loadSession(id);
  if (!s) notFound();
  const materials = await sql<Material[]>`
    select id, kind, title, url, body, filename, mime, size::int as size, complete
    from materials where session_id = ${id} order by position, created_at`;
  const [{ notes }] = await sql<{ notes: number }[]>`select count(*)::int as notes from notes where session_id = ${id} and length(body) > 0`;
  const nav = await sql<{ id: string; number: number }[]>`
    select id, number from ag_sessions where group_id = ${s.group_id} order by number`;
  const pos = nav.findIndex((n) => n.id === id);
  const items = await loadItems(id);
  const live = await liveSlide(id);
  const [deck] = await sql<{ filename: string; slides: number; at: string }[]>`
    select filename, slides, to_char(uploaded_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as at from session_decks where session_id = ${id}`;
  const answers = items.length ? await sql<{ item_id: string; pseudonym: string; key: string; value: string }[]>`
    select r.item_id, u.pseudonym, r.key, r.value from live_responses r join users u on u.id = r.user_id
    where r.item_id in ${sql(items.map((i) => i.id))} order by u.pseudonym, r.key, r.created_at` : [];

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 32 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Link href={`/coach/sitzungen?ag=${s.group_id}`}>Alle Sitzungen</Link>
              <span style={{ display: "flex", gap: 14 }}>
                {pos > 0 && <Link href={`/coach/sitzungen/${nav[pos - 1].id}`}>Sitzung {nav[pos - 1].number}</Link>}
                {pos < nav.length - 1 && <Link href={`/coach/sitzungen/${nav[pos + 1].id}`}>Sitzung {nav[pos + 1].number}</Link>}
              </span>
            </div>
            <div className="tags">
              <span className="tag outline">Sitzung {s.number}</span>
              {s.date_label && <span className="tag">{germanDay(s.date_label)}</span>}
              <span className={`tag`}>{s.published ? "veröffentlicht" : "Entwurf, für Teilnehmende unsichtbar"}</span>
            </div>
            <h1>{s.title || `Sitzung ${s.number}`}</h1>
            <div className="head-actions">
              <form action={togglePublished}>
                <input type="hidden" name="id" value={s.id} />
                <button className={`btn${s.published ? " ghost" : ""}`} type="submit">{s.published ? "Wieder verstecken" : "Für Teilnehmende veröffentlichen"}</button>
              </form>
              {s.published && <Link className="btn ghost" href={`/sitzungen/${s.id}`}>So sehen es die Teilnehmenden</Link>}
            </div>
            {notes > 0 && <p className="faint">{notes} {notes === 1 ? "Person hat" : "Personen haben"} Notizen zu dieser Sitzung. Die Notizen sind privat, du siehst nur die Anzahl.</p>}
          </section>

          <section className="card">
            <header><h3>Angaben</h3></header>
            <EditSessionForm s={s} />
          </section>

          <section className="section" id="live">
            <div className="stack" style={{ gap: 8 }}>
              <h2>Live während der Sitzung</h2>
              <p className="muted">Lade den Foliensatz als HTML hoch und starte die Präsentation von hier. Sobald du auf eine Folie mit Interaktion kommst, erscheint sie automatisch auf den Geräten unter Sitzung {s.number}. Mit der Taste E zeigst du die Ergebnisse auf der Tafel.</p>
            </div>
            <div className="two-col">
              <section className="card">
                <header><h3>Foliensatz</h3>{deck && <span className="chip live">{deck.slides} Folien</span>}</header>
                <div className="body">
                  {deck ? <p className="faint">{deck.filename}, hochgeladen am {deck.at}</p> : <p className="faint">Noch kein Foliensatz. Erwartet wird der HTML-Export aus Claude Slides.</p>}
                  <DeckUpload sessionId={s.id} has={!!deck} />
                  {deck && <div><Link className="btn" href={`/coach/sitzungen/${s.id}/praesentation`}>Präsentation starten</Link></div>}
                </div>
              </section>
              <section className="card">
                <header><h3>Status</h3><span className={`chip${live !== null ? " live" : ""}`}>{live !== null ? `live auf Folie ${live}` : "nicht live"}</span></header>
                <div className="body">
                  <p className="faint">Ohne Präsentation kannst du jede Interaktion auch direkt mit „Jetzt öffnen“ starten. Die Teilnehmenden sehen sie dann unter Sitzung {s.number}.</p>
                  {live !== null && <form action={stopLive}><input type="hidden" name="session_id" value={s.id} /><button className="btn ghost" type="submit">Live beenden</button></form>}
                  {!s.published && <div className="alert error">Die Sitzung ist noch nicht veröffentlicht. Die Teilnehmenden sehen die Interaktionen erst nach dem Veröffentlichen.</div>}
                </div>
              </section>
            </div>

            {items.map((it) => {
              const mine = answers.filter((a) => a.item_id === it.id);
              const people = new Set(mine.map((a) => a.pseudonym)).size;
              return (
                <section className="card" key={it.id}>
                  <header>
                    <h3>{it.title}</h3>
                    <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span className="chip">{KIND_LABEL[it.kind]}</span>
                      <span className="chip">{slideInfo(it)}</span>
                      <span className={`chip${people ? " live" : ""}`}>{people} {people === 1 ? "Person" : "Personen"}</span>
                    </span>
                  </header>
                  <div className="body">
                    <div className="live-actions">
                      {it.slide !== null && <ItemOp id={it.id} op="open" label="Jetzt öffnen" />}
                      {it.reveal_slide !== null && <ItemOp id={it.id} op="reveal" label="Auflösung zeigen" />}
                      {it.homework && <ItemOp id={it.id} op="toggle" label={it.closed ? "Wieder öffnen" : "Schließen"} />}
                      {people > 0 && <ItemOp id={it.id} op="reset" label="Antworten löschen" ghost={false} />}
                      <ItemOp id={it.id} op="delete" label="Interaktion entfernen" ghost={false} />
                    </div>
                    {mine.length > 0 && (
                      <details>
                        <summary>Antworten mit Namen ansehen</summary>
                        <div className="table-wrap" style={{ marginTop: 12 }}>
                          <table>
                            <thead><tr><th>Name</th><th>{it.kind === "grid" ? "Aussage" : it.kind === "wall" ? "Spalte" : "Frage"}</th><th>Antwort</th></tr></thead>
                            <tbody>
                              {mine.map((a, k) => {
                                const ri = Number(a.key.split(":")[0]);
                                return (
                                  <tr key={k}>
                                    <td>{a.pseudonym}</td>
                                    <td>{it.rows[ri] ?? ""}</td>
                                    <td style={{ whiteSpace: "pre-wrap" }}>{it.kind === "grid" ? it.options[Number(a.value)] ?? a.value : a.value}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                    <details>
                      <summary>Bearbeiten</summary>
                      <div style={{ marginTop: 14 }}><LiveItemForm sessionId={s.id} item={it} /></div>
                    </details>
                  </div>
                </section>
              );
            })}

            <div className="two-col">
              <section className="card">
                <header><h3>Neue Interaktion</h3></header>
                <div className="body"><LiveItemForm sessionId={s.id} /></div>
              </section>
              <section className="card">
                <header><h3>Vorlage einfügen</h3></header>
                <div className="body">
                  <p className="faint">Fertige Interaktionen passend zu einem Foliensatz. Danach kannst du alles einzeln anpassen.</p>
                  <TemplateForm sessionId={s.id} templates={Object.entries(TEMPLATES).map(([k, t]) => ({ id: k, label: t.label }))} />
                </div>
              </section>
            </div>
          </section>

          <section className="section">
            <h2>Material</h2>
            <MaterialList items={materials} coach />
            <div className="two-col">
              <section className="card">
                <header><h3>Dateien hochladen</h3></header>
                <div className="body"><Uploader sessionId={s.id} /></div>
              </section>
              <section className="card">
                <header><h3>Link hinzufügen</h3></header>
                <div className="body"><LinkForm sessionId={s.id} /></div>
              </section>
            </div>
            <section className="card">
              <header><h3>Text oder Aufgabe hinzufügen</h3></header>
              <div className="body"><TextForm sessionId={s.id} /></div>
            </section>
          </section>

          <div style={{ alignSelf: "flex-start" }}><DeleteSession id={s.id} /></div>
        </div>
      </main>
    </>
  );
}
