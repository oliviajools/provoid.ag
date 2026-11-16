import type { Metadata } from "next";
import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { PHASES, germanDay } from "@/lib/sessions";
import { listGroups, pickGroup } from "@/lib/groups";
import { loadDocumentation } from "@/lib/documentation";
import { Topbar } from "@/components/Topbar";
import { AgPicker, AgTag } from "@/components/AgPicker";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Dokumentation" };
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");

export default async function Dokumentation({ searchParams }: { searchParams: Promise<{ ag?: string; alle?: string }> }) {
  const coach = await requireCoach();
  const { ag, alle } = await searchParams;
  const groups = await listGroups();
  const group = await pickGroup(groups, ag);
  const doc = group ? await loadDocumentation(group.id) : null;
  const shown = doc ? doc.sessions.filter((s) => alle ? true : s.held) : [];
  const held = doc ? doc.sessions.filter((s) => s.held) : [];
  const status = (sid: string, uid: string) => doc?.att.find((a) => a.session_id === sid && a.user_id === uid)?.status ?? null;
  const presentIn = (sid: string) => doc?.att.filter((a) => a.session_id === sid && a.status === "present").length ?? 0;
  const totalPresent = held.reduce((n, s) => n + presentIn(s.id), 0);
  const today = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 32 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Dokumentation</span><AgTag g={group} /></div>
              <h1>{group ? `Dokumentation ${[group.short_name || group.name, group.cohort].filter(Boolean).join(" ")}` : "Dokumentation"}</h1>
              {group && <p className="muted">{[group.schedule, group.school, group.starts && `Start ${group.starts}`].filter(Boolean).join(" · ")} · Stand {today}</p>}
            </div>
            <div className="stack no-print" style={{ gap: 10, alignItems: "flex-start" }}>
              <AgPicker groups={groups} current={group} next={alle ? "/coach/dokumentation?alle=1" : "/coach/dokumentation"} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PrintButton />
                {group && <a className="btn ghost" href={`/coach/dokumentation/csv?ag=${group.id}`}>Anwesenheit als CSV</a>}
                {group && <Link className="btn ghost" href={`/coach/dokumentation?ag=${group.id}${alle ? "" : "&alle=1"}`}>{alle ? "Nur stattgefundene" : "Auch geplante Sitzungen"}</Link>}
              </div>
            </div>
          </section>

          {!group || !doc ? <p className="muted">Leg zuerst im Coach-Bereich eine AG an.</p> : (
            <>
              <section className="card">
                <header><h3>Auf einen Blick</h3></header>
                <div className="body">
                  <div className="meta-row">
                    <span><b>{held.length}</b> {held.length === 1 ? "Sitzung" : "Sitzungen"} stattgefunden</span>
                    <span><b>{doc.members.length}</b> Teilnehmende registriert</span>
                    <span>Ø <b>{held.length ? (totalPresent / held.length).toFixed(1).replace(".", ",") : "–"}</b> anwesend je Sitzung</span>
                  </div>
                </div>
              </section>

              <section className="card">
                <header><h3>Was wir gemacht haben und wer da war</h3></header>
                <div className="body" style={{ gap: 0 }}>
                  {shown.length === 0 && <p className="muted">Noch keine Sitzung mit Datum in der Vergangenheit.</p>}
                  {shown.map((s) => {
                    const items = doc.items.filter((i) => i.session_id === s.id);
                    const guests = doc.guests.filter((g) => g.session_id === s.id);
                    const by = (st: string) => doc.members.filter((m) => status(s.id, m.id) === st).map((m) => m.pseudonym);
                    const open = doc.members.filter((m) => !m.disabled && status(s.id, m.id) === null).map((m) => m.pseudonym);
                    const p = by("present"), e = by("excused"), a = by("absent");
                    return (
                      <article className="doc-session" key={s.id}>
                        <h3>
                          <span>Sitzung {s.number}{s.title ? `: ${s.title}` : ""}</span>
                          <span className="faint">{[germanDay(s.date_label), s.phase && PHASES[s.phase]].filter(Boolean).join(" · ")}</span>
                          <Link className="faint no-print" href={`/coach/sitzungen/${s.id}#anwesenheit`}>bearbeiten</Link>
                        </h3>
                        {s.summary && <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{s.summary}</p>}
                        {s.protocol && <p style={{ whiteSpace: "pre-wrap" }}><b>Protokoll:</b> {s.protocol}</p>}
                        {(items.length > 0 || guests.length > 0) && (
                          <p className="doc-names">
                            {guests.length > 0 && <><b>Zu Gast:</b> {guests.map((g) => g.role ? `${g.name} (${g.role})` : g.name).join(", ")}. </>}
                            {items.length > 0 && <><b>Live-Aufgaben:</b> {items.map((i) => `${i.title} (${i.people})`).join(" · ")}</>}
                          </p>
                        )}
                        <p className="doc-names">
                          <b>Da ({p.length}):</b> {p.join(", ") || "noch nicht eingetragen"}
                          {e.length > 0 && <><br /><b>Entschuldigt ({e.length}):</b> {e.join(", ")}</>}
                          {a.length > 0 && <><br /><b>Gefehlt ({a.length}):</b> {a.join(", ")}</>}
                          {s.held && open.length > 0 && <><br /><span className="faint">Ohne Eintrag: {open.join(", ")}</span></>}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>

              {doc.members.length > 0 && held.length > 0 && (
                <section className="card">
                  <header><h3>Anwesenheit je Person</h3></header>
                  <div className="body">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Name</th>{held.map((s) => <th key={s.id} title={s.title}>{s.number}</th>)}<th>da</th><th>Quote</th></tr>
                        </thead>
                        <tbody>
                          {doc.members.map((m) => {
                            const marks = held.map((s) => status(s.id, m.id));
                            const n = marks.filter((x) => x === "present").length;
                            return (
                              <tr key={m.id}>
                                <td><b>{m.pseudonym}</b>{m.disabled && <span className="faint"> (pausiert)</span>}</td>
                                {marks.map((x, i) => <td key={i}>{x === "present" ? "✓" : x === "excused" ? "e" : x === "absent" ? "✗" : ""}</td>)}
                                <td>{n}/{held.length}</td>
                                <td>{pct(n, held.length)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="faint">✓ da · e entschuldigt · ✗ gefehlt · leer: kein Eintrag. Spalten sind die Sitzungsnummern.</p>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
