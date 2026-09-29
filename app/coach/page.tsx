import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { toggleDisabled, toggleRegistration } from "./actions";
import { CreateGroupForm, ResetPasswordButton } from "./CoachForms";

export const metadata: Metadata = { title: "Coach" };
export const dynamic = "force-dynamic";

type Group = { id: string; name: string; school: string; code: string; registration_open: boolean; starts: string | null; members: number };
type Member = { id: string; group_id: string; pseudonym: string; disabled: boolean; created: string; last_login: string | null; must_change_password: boolean };

export default async function Coach() {
  const coach = await requireCoach();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "ag.provoid.de";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const [{ n: pendingNews }] = await sql<{ n: number }[]>`select count(*)::int as n from news_items where status = 'pending' and origin = 'kid'`;
  const groups = await sql<Group[]>`
    select g.id, g.name, g.school, g.code, g.registration_open,
           to_char(g.starts_on, 'DD.MM.YYYY') as starts,
           (select count(*)::int from users u where u.group_id = g.id) as members
    from groups g order by g.created_at desc`;
  const members = await sql<Member[]>`
    select id, group_id, pseudonym, disabled, must_change_password,
           to_char(created_at at time zone 'Europe/Berlin', 'DD.MM.YY') as created,
           to_char(last_login_at at time zone 'Europe/Berlin', 'DD.MM.YY, HH24:MI') as last_login
    from users where role = 'student' order by pseudonym_lower`;

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page">
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Coach-Bereich</span></div>
              <h1>Deine AGs.</h1>
              <p className="lead">Leg AGs an, verteil den AG-Code und hilf, wenn jemand sein Passwort vergessen hat.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/coach/radar" className="btn">KI-Radar{pendingNews > 0 ? ` (${pendingNews} neu)` : ""}</Link>
              <Link href="/coach/sitzungen" className="btn ghost">Sitzungen und Material</Link>
              <Link href="/coach/kompass" className="btn ghost">Kompass-Auswertung</Link>
              <Link href="/ideen" className="btn ghost">Ideen-Wand</Link>
              <Link href="/start" className="btn ghost">Schüleransicht ansehen</Link>
            </div>
          </section>

          <section className="card" aria-labelledby="new-ag">
            <header><h3 id="new-ag">Neue AG anlegen</h3></header>
            <CreateGroupForm />
          </section>

          <section className="groups" aria-label="AGs">
            {groups.length === 0 && <p className="muted">Noch keine AG angelegt.</p>}
            {groups.map((g) => {
              const list = members.filter((m) => m.group_id === g.id);
              const joinUrl = `${proto}://${host}/registrieren?code=${g.code}`;
              return (
                <article className="card" key={g.id}>
                  <header>
                    <div className="stack" style={{ gap: 2 }}>
                      <h3>{g.name}</h3>
                      <span className="faint">{[g.school, g.starts && `Start ${g.starts}`].filter(Boolean).join(" · ")}</span>
                    </div>
                    <span className="codebox" aria-label="AG-Code">{g.code}</span>
                  </header>
                  <div className="body">
                    <div className="meta-row">
                      <span>{g.members} {g.members === 1 ? "Mitglied" : "Mitglieder"}</span>
                      <span className={`chip${g.registration_open ? " live" : ""}`}>
                        {g.registration_open ? "Anmeldung offen" : "Anmeldung geschlossen"}
                      </span>
                      <form action={toggleRegistration}>
                        <input type="hidden" name="group_id" value={g.id} />
                        <button className="btn ghost small" type="submit">
                          {g.registration_open ? "Anmeldung schließen" : "Anmeldung öffnen"}
                        </button>
                      </form>
                    </div>
                    <p className="faint">Direktlink zur Anmeldung: <span style={{ color: "var(--muted)", userSelect: "all" }}>{joinUrl}</span></p>
                    {list.length > 0 && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Pseudonym</th><th>Dabei seit</th><th>Letzter Login</th><th>Status</th><th>Aktionen</th></tr>
                          </thead>
                          <tbody>
                            {list.map((m) => (
                              <tr key={m.id}>
                                <td><b>{m.pseudonym}</b></td>
                                <td>{m.created}</td>
                                <td>{m.last_login ?? "noch nie"}</td>
                                <td>
                                  {m.disabled ? <span className="chip">Pausiert</span>
                                    : m.must_change_password ? <span className="chip">Passwort neu</span>
                                    : <span className="chip live">Aktiv</span>}
                                </td>
                                <td>
                                  <div className="actions">
                                    <ResetPasswordButton userId={m.id} />
                                    <form action={toggleDisabled}>
                                      <input type="hidden" name="user_id" value={m.id} />
                                      <button className="btn ghost small" type="submit">{m.disabled ? "Aktivieren" : "Pausieren"}</button>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>
    </>
  );
}
