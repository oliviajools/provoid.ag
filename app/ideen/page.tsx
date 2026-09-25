import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { THEMES, topThemes, type Answers } from "@/lib/compass";

export const metadata: Metadata = { title: "Ideen-Wand" };
export const dynamic = "force-dynamic";

type Row = { user_id: string; pseudonym: string; share_dream: "name" | "anon"; answers: Answers; group_id: string };

export default async function Ideen({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const user = await requireUser();
  const { ag } = await searchParams;
  const isCoach = user.role === "coach";
  const groups = isCoach ? await sql<{ id: string; name: string }[]>`select id, name from groups order by created_at desc` : [];
  const groupId = isCoach ? (groups.find((g) => g.id === ag)?.id ?? groups[0]?.id) : user.group_id;

  const rows = groupId
    ? await sql<Row[]>`
        select c.user_id, u.pseudonym, c.share_dream, c.answers, u.group_id
        from compass c join users u on u.id = c.user_id
        where u.group_id = ${groupId} and c.round = 1 and c.share_dream in ('name', 'anon') and u.disabled = false
        order by c.completed_at`
    : [];
  const mine = !isCoach ? (await sql`select 1 from compass where user_id = ${user.id} and round = 1`).length > 0 : true;

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={isCoach ? "/coach" : "/start"} />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Ideen-Wand</span><span className="tag">{rows.length} {rows.length === 1 ? "Idee" : "Ideen"}</span></div>
              <h1>Was wir bauen würden, wenn alles ginge.</h1>
              <p className="lead">Die Traumprojekte eurer AG. Entdeckst du jemanden mit einer ähnlichen Idee? Sprecht in der nächsten Session darüber.</p>
            </div>
            {isCoach && groups.length > 1 && (
              <form className="stack" style={{ gap: 6 }}>
                <label htmlFor="ag" className="faint">AG wählen</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select id="ag" name="ag" defaultValue={groupId ?? undefined} className="select">
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button className="btn ghost small" type="submit">Anzeigen</button>
                </div>
              </form>
            )}
          </section>

          {!mine && (
            <div className="alert ok">Du hast deinen Kompass noch nicht ausgefüllt. <Link href="/kompass">Jetzt starten</Link>, dann kannst du deine Idee hier dazustellen.</div>
          )}

          {rows.length === 0 ? (
            <p className="muted">Noch keine Ideen an der Wand. Die ersten erscheinen, sobald jemand seinen Kompass ausgefüllt und die Idee freigegeben hat.</p>
          ) : (
            <div className="wall">
              {rows.map((r) => {
                const t = topThemes(r.answers.cards, 1)[0];
                const own = r.user_id === user.id;
                return (
                  <article className={`idea-note${own ? " mine" : ""}`} key={r.user_id}>
                    <p>{r.answers.dream}</p>
                    <footer>
                      <b>{r.share_dream === "name" ? r.pseudonym : "Anonym"}{own ? " (du)" : ""}</b>
                      {t && <span>· {THEMES[t]}</span>}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
