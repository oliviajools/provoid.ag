import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import type { SignupForm } from "@/lib/signups";
import { signupAction, toggleForm } from "./actions";

export const metadata: Metadata = { title: "Anmeldungen" };
export const dynamic = "force-dynamic";

type Row = { id: string; form_id: string; option_id: string; child_first: string; child_last: string; class_name: string;
  parent_name: string; email: string; phone: string; photo_ok: boolean; notes: string; waitlist: boolean; created: string };

export default async function Anmeldungen() {
  const coach = await requireCoach();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "ag.provoid.de";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const forms = await sql<SignupForm[]>`select id, slug, title, school, intro, options, open from signup_forms order by created_at`;
  const rows = await sql<Row[]>`
    select id, form_id, option_id, child_first, child_last, class_name, parent_name, email, phone, photo_ok, notes, waitlist,
           to_char(created_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as created
    from signups order by created_at`;

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="stack" style={{ gap: 14 }}>
            <div className="tags"><span className="tag outline">Anmeldungen</span><span className="tag">{rows.length} insgesamt</span></div>
            <h1>Wer sich angemeldet hat.</h1>
            <p className="lead">Die Anmeldungen der Eltern. Die Daten enthalten echte Namen, sie bleiben im Coach-Bereich und kommen nicht auf die Lernplattform.</p>
          </section>

          {forms.map((f) => {
            const link = `${proto}://${host}/anmeldung/${f.slug}`;
            const list = rows.filter((r) => r.form_id === f.id);
            return (
              <section className="section" key={f.id} style={{ gap: 18 }}>
                <div className="welcome" style={{ alignItems: "center" }}>
                  <div className="stack" style={{ gap: 4 }}>
                    <h2>{f.school}</h2>
                    <span className="faint">Link für die Eltern: <span style={{ color: "var(--muted)", userSelect: "all" }}>{link}</span></span>
                  </div>
                  <div className="head-actions">
                    <Link className="btn ghost small" href={`/anmeldung/${f.slug}`} target="_blank">Formular ansehen</Link>
                    <a className="btn small" href={`/api/anmeldungen/${f.id}`}>Als Tabelle (CSV) herunterladen</a>
                    <form action={toggleForm}><input type="hidden" name="id" value={f.id} />
                      <button className="btn ghost small" type="submit">{f.open ? "Anmeldung schließen" : "Anmeldung öffnen"}</button></form>
                    <span className={`status-pill ${f.open ? "published" : ""}`}>{f.open ? "offen" : "geschlossen"}</span>
                  </div>
                </div>
                {f.options.map((o) => {
                  const g = list.filter((r) => r.option_id === o.id);
                  const placed = g.filter((r) => !r.waitlist);
                  const waiting = g.filter((r) => r.waitlist);
                  return (
                    <section className="card" key={o.id}>
                      <header>
                        <h3>{o.label}</h3>
                        <span className={`chip${placed.length >= o.capacity ? "" : " live"}`}>{placed.length} von {o.capacity} Plätzen{waiting.length ? ` · ${waiting.length} auf der Warteliste` : ""}</span>
                      </header>
                      <div className="body table-wrap">
                        {g.length === 0 ? <p className="muted">Noch keine Anmeldungen.</p> : (
                          <table>
                            <thead><tr><th>Kind</th><th>Klasse</th><th>Eltern</th><th>Kontakt</th><th>Fotos</th><th>Angemeldet</th><th>Status</th><th></th></tr></thead>
                            <tbody>
                              {g.map((r) => (
                                <tr key={r.id}>
                                  <td><b>{r.child_first} {r.child_last}</b>{r.notes && <><br /><span className="faint">{r.notes}</span></>}</td>
                                  <td>{r.class_name}</td>
                                  <td>{r.parent_name}</td>
                                  <td style={{ wordBreak: "break-all" }}>{r.email}{r.phone && <><br />{r.phone}</>}</td>
                                  <td>{r.photo_ok ? "ja" : "nein"}</td>
                                  <td>{r.created}</td>
                                  <td><span className={`status-pill ${r.waitlist ? "pending" : "published"}`}>{r.waitlist ? "Warteliste" : "Platz"}</span></td>
                                  <td>
                                    <div className="actions">
                                      <form action={signupAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="waitlist" />
                                        <button className="btn ghost small" type="submit">{r.waitlist ? "Platz geben" : "Auf Warteliste"}</button></form>
                                      <form action={signupAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="delete" />
                                        <button className="linkish" type="submit" style={{ padding: 0 }}>Löschen</button></form>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </section>
                  );
                })}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
