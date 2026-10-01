import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { aiEnabled } from "@/lib/news";

const AUTO_MAX = Number(process.env.AUTO_PUBLISH_MAX ?? 5);
import { Topbar } from "@/components/Topbar";
import { discardAllFeed, setStatus, toggleFeed } from "./actions";
import { AddFeedForm, AddManualForm, ImportButton, QueueActions, TestFeedButton } from "./RadarForms";

export const metadata: Metadata = { title: "KI-Radar verwalten" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Q = {
  id: string; origin: "kid" | "feed" | "coach"; url: string; title: string; source_name: string; excerpt: string;
  kid_note: string; kid_check: { who?: string; when?: string; evidence?: string } | null; finder: string | null;
  group_name: string | null; created: string; source_date: string | null; status: string; headline: string | null; reactions: number;
  ai_score: number | null; auto_published: boolean; has_card: boolean;
};
type F = { id: string; name: string; url: string; keyword_filter: boolean; auto_publish: boolean; active: boolean; last_status: string | null; fetched: string | null };

const EVIDENCE: Record<string, string> = { ja: "Belege genannt", nein: "keine Belege", unklar: "Belege unklar" };

export default async function CoachRadar() {
  const coach = await requireCoach();
  const ai = aiEnabled();
  const items = await sql<Q[]>`
    select n.id, n.origin, n.url, n.title, n.source_name, n.excerpt, n.kid_note, n.kid_check, n.status,
           n.ai_score, n.auto_published, (n.card is not null) as has_card,
           u.pseudonym as finder, g.name as group_name, n.card->>'headline' as headline,
           to_char(n.created_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as created,
           to_char(n.source_date at time zone 'Europe/Berlin', 'DD.MM.') as source_date,
           (select count(*)::int from news_reactions r where r.item_id = n.id) as reactions
    from news_items n
    left join users u on u.id = n.submitted_by
    left join groups g on g.id = n.group_id
    where n.status in ('pending', 'published', 'hidden')
    order by (n.origin = 'kid') desc, coalesce(n.published_at, n.source_date, n.created_at) desc
    limit 200`;
  const feeds = await sql<F[]>`
    select id, name, url, keyword_filter, auto_publish, active, last_status,
           to_char(last_fetched_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as fetched
    from feeds order by active desc, name`;
  const autoCount = items.filter((i) => i.auto_published && i.status === "published").length;
  const kidQueue = items.filter((i) => i.status === "pending" && i.origin === "kid");
  const feedQueue = items.filter((i) => i.status === "pending" && i.origin !== "kid");
  const published = items.filter((i) => i.status !== "pending");

  const QueueItem = ({ q }: { q: Q }) => (
    <article className="qitem">
      <div className="qhead">
        <div className="stack" style={{ gap: 4 }}>
          <h4>{q.title || q.url}</h4>
          <div className="qmeta">
            <span>{q.source_name}</span>
            {q.source_date && <span>vom {q.source_date}</span>}
            <span>eingegangen {q.created}</span>
            {q.group_name && <span>{q.group_name}</span>}
            {q.ai_score != null && <span style={{ color: q.ai_score >= 3 ? "var(--ok)" : "var(--warn)" }}>KI-Bewertung {q.ai_score}/5{q.has_card ? ", Karte fertig" : ""}</span>}
          </div>
        </div>
        <a className="btn ghost small" href={q.url} target="_blank" rel="noreferrer">Quelle öffnen</a>
      </div>
      {q.excerpt && <p className="faint">{q.excerpt.slice(0, 280)}</p>}
      {q.origin === "kid" && (
        <div className="qnote">
          <b style={{ color: "var(--warn)" }}>{q.finder}:</b> „{q.kid_note}“
          {q.kid_check && (
            <div className="faint" style={{ marginTop: 4 }}>
              Quellen-Check: {[q.kid_check.who && `von ${q.kid_check.who}`, q.kid_check.when && `Datum: ${q.kid_check.when}`, q.kid_check.evidence && EVIDENCE[q.kid_check.evidence]].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}
      <QueueActions id={q.id} kid={q.origin === "kid"} ai={ai} />
    </article>
  );

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 44 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">KI-Radar</span><span className="tag">{kidQueue.length + feedQueue.length} warten auf dich</span>{autoCount > 0 && <span className="tag">{autoCount} automatisch veröffentlicht</span>}</div>
              <h1>Prüfen, freigeben, fertig.</h1>
              <p className="lead">
                Du prüfst jede Quelle. {ai ? "Beim Freigeben schreibt die KI automatisch eine jugendgerechte Karte, die du danach noch anpassen kannst." : "Beim Freigeben schreibst du die Karte selbst."}
              </p>
              <div className="head-actions"><Link className="btn ghost" href="/radar">Radar ansehen</Link></div>
            </div>
            <ImportButton />
          </section>

          {!ai && (
            <div className="alert error">
              Die automatische Aufbereitung ist noch aus. Trag in Vercel die Umgebungsvariable <b>ANTHROPIC_API_KEY</b> ein, dann schreibt die KI die Karten beim Freigeben selbst.
            </div>
          )}

          <section className="section">
            <h2>Von den Kids <span className="faint" style={{ fontSize: 16 }}>({kidQueue.length})</span></h2>
            <div className="queue">
              {kidQueue.length === 0 ? <p className="muted">Keine offenen Einreichungen.</p> : kidQueue.map((q) => <QueueItem q={q} key={q.id} />)}
            </div>
          </section>

          <section className="section">
            <div className="welcome" style={{ alignItems: "center" }}>
              <h2>Aus deinen Quellen <span className="faint" style={{ fontSize: 16 }}>({feedQueue.length})</span></h2>
              {feedQueue.length > 0 && (
                <form action={discardAllFeed}><button className="btn ghost small" type="submit">Alle {feedQueue.length} verwerfen</button></form>
              )}
            </div>
            <div className="queue">
              {feedQueue.length === 0 ? <p className="muted">Nichts Neues. Aktiviere Quellen unten oder ruf sie mit dem Knopf oben ab. Einmal am Tag passiert das automatisch.</p>
                : feedQueue.slice(0, 40).map((q) => <QueueItem q={q} key={q.id} />)}
            </div>
            <div className="card"><header><h3>Eigenen Link aufnehmen</h3></header><div className="body"><AddManualForm /></div></div>
          </section>

          <section className="section">
            <h2>Im Radar</h2>
            <div className="card">
              <div className="body table-wrap">
                {published.length === 0 ? <p className="muted">Noch nichts veröffentlicht.</p> : (
                  <table>
                    <thead><tr><th>Karte</th><th>Herkunft</th><th>Reaktionen</th><th>Status</th><th>Aktionen</th></tr></thead>
                    <tbody>
                      {published.map((p) => (
                        <tr key={p.id}>
                          <td style={{ minWidth: 260 }}><b>{p.headline ?? p.title}</b><br /><span className="faint">{p.source_name}</span></td>
                          <td>{p.origin === "kid" ? `von ${p.finder}` : p.origin === "feed" ? (p.auto_published ? `automatisch (${p.ai_score}/5)` : "Quelle") : "Coach"}</td>
                          <td>{p.reactions}</td>
                          <td><span className={`status-pill ${p.status === "published" ? "published" : ""}`}>{p.status === "published" ? "sichtbar" : "ausgeblendet"}</span></td>
                          <td>
                            <div className="actions">
                              <Link className="btn ghost small" href={`/coach/radar/${p.id}`}>Bearbeiten</Link>
                              <form action={setStatus}>
                                <input type="hidden" name="id" value={p.id} />
                                <input type="hidden" name="status" value={p.status === "published" ? "hidden" : "published"} />
                                <button className="btn ghost small" type="submit">{p.status === "published" ? "Ausblenden" : "Wieder zeigen"}</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="stack" style={{ gap: 8 }}>
              <h2>Verifizierte Quellen</h2>
              <p className="muted">Nur aktive Quellen werden abgerufen, jeden Morgen um 7 Uhr automatisch. Teste eine Quelle, bevor du sie aktivierst. Bei gemischten Nachrichtenseiten sorgt der KI-Filter dafür, dass nur Artikel über KI ankommen.</p>
              <p className="muted"><b style={{ color: "var(--text)" }}>Automatisch veröffentlichen:</b> Bei diesen Quellen schreibt die KI die Karten selbst und bewertet, ob sie für Jugendliche passen. Bis zu {AUTO_MAX} Meldungen pro Tag mit mindestens 3 von 5 Punkten gehen direkt ins Radar. Der Rest wartet mit fertiger Karte auf dich. Ausblenden kannst du jederzeit.</p>
            </div>
            <div className="card">
              <div className="body table-wrap">
                <table className="feeds-table">
                  <thead><tr><th>Quelle</th><th>KI-Filter</th><th>Automatisch veröffentlichen</th><th>Letzter Stand</th><th>Status</th><th>Aktionen</th></tr></thead>
                  <tbody>
                    {feeds.map((f) => (
                      <tr key={f.id}>
                        <td style={{ minWidth: 200 }}><b>{f.name}</b><br /><span className="faint" style={{ wordBreak: "break-all" }}>{f.url}</span></td>
                        <td>
                          <form action={toggleFeed}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="field" value="filter" />
                            <button className="btn ghost small" type="submit">{f.keyword_filter ? "an" : "aus"}</button></form>
                        </td>
                        <td>
                          <form action={toggleFeed}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="field" value="auto" />
                            <button className={`btn small${f.auto_publish ? "" : " ghost"}`} type="submit" disabled={!f.active && !f.auto_publish}>{f.auto_publish ? "an" : "aus"}</button></form>
                        </td>
                        <td style={{ minWidth: 160 }}>{f.last_status ?? "noch nie getestet"}{f.fetched && <><br /><span className="faint">{f.fetched}</span></>}</td>
                        <td><span className={`status-pill ${f.active ? "published" : ""}`}>{f.active ? "aktiv" : "inaktiv"}</span></td>
                        <td>
                          <div className="actions">
                            <TestFeedButton id={f.id} />
                            <form action={toggleFeed}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="field" value="active" />
                              <button className={`btn small${f.active ? " ghost" : ""}`} type="submit">{f.active ? "Deaktivieren" : "Aktivieren"}</button></form>
                            {!f.active && (
                              <form action={toggleFeed}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="field" value="delete" />
                                <button className="btn ghost small" type="submit">Entfernen</button></form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <AddFeedForm />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
