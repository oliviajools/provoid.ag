import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listGroups, pickGroup } from "@/lib/groups";
import { AgPicker, AgTag } from "@/components/AgPicker";
import { Topbar } from "@/components/Topbar";
import { THEMES, topThemes, type Answers } from "@/lib/compass";

export const metadata: Metadata = { title: "Ideen-Wand" };
export const dynamic = "force-dynamic";

type Row = { user_id: string; pseudonym: string; share_dream: "name" | "anon"; answers: Answers; group_id: string };

export default async function Ideen({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const user = await requireUser();
  const { ag } = await searchParams;
  const isCoach = user.role === "coach";
  const groups = isCoach ? await listGroups() : [];
  const group = isCoach ? await pickGroup(groups, ag) : undefined;
  const groupId = isCoach ? group?.id : user.group_id;

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
            {isCoach && <AgPicker groups={groups} current={group} next="/ideen" />}
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
