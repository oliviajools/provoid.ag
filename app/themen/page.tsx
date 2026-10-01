import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { deleteOwnWish, setWishStatus, toggleVote } from "./actions";
import { WishForm } from "./WishForm";

export const metadata: Metadata = { title: "Themenwünsche" };
export const dynamic = "force-dynamic";

type Wish = {
  id: string; title: string; details: string; anonymous: boolean; status: "open" | "planned" | "done" | "hidden";
  coach_note: string; author: string | null; mine: boolean; votes: number; voted: boolean; created: string;
};
const STATUS = { open: "offen", planned: "eingeplant", done: "besprochen", hidden: "ausgeblendet" } as const;

export default async function Themen({ searchParams }: { searchParams: Promise<{ ag?: string }> }) {
  const user = await requireUser();
  const isCoach = user.role === "coach";
  const { ag } = await searchParams;
  const groups = isCoach ? await sql<{ id: string; name: string }[]>`select id, name from groups order by created_at desc` : [];
  const groupId = isCoach ? (groups.find((g) => g.id === ag)?.id ?? groups[0]?.id) : user.group_id;
  const wishes = groupId ? await sql<Wish[]>`
    select w.id, w.title, w.details, w.anonymous, w.status, w.coach_note,
           u.pseudonym as author, (w.user_id = ${user.id}) as mine,
           to_char(w.created_at at time zone 'Europe/Berlin', 'DD.MM.') as created,
           (select count(*)::int from topic_votes v where v.wish_id = w.id) as votes,
           exists (select 1 from topic_votes v where v.wish_id = w.id and v.user_id = ${user.id}) as voted
    from topic_wishes w left join users u on u.id = w.user_id
    where w.group_id = ${groupId} ${isCoach ? sql`` : sql`and w.status <> 'hidden'`}
    order by (w.status = 'done'), (w.status = 'hidden'), votes desc, w.created_at desc` : [];
  const active = wishes.filter((w) => w.status === "open" || w.status === "planned");
  const rest = wishes.filter((w) => w.status === "done" || w.status === "hidden");

  const Item = ({ w }: { w: Wish }) => (
    <article className={`wish${w.status === "done" || w.status === "hidden" ? " muted-wish" : ""}`}>
      <form action={toggleVote} className="vote">
        <input type="hidden" name="id" value={w.id} />
        <button type="submit" className={`vote-btn${w.voted ? " on" : ""}`} disabled={isCoach || w.status === "hidden"}
          aria-pressed={w.voted} aria-label={w.voted ? "Stimme zurücknehmen" : "Will ich auch"}>
          <span className="n">{w.votes}</span>
          <span className="l">{isCoach ? (w.votes === 1 ? "Stimme" : "Stimmen") : w.voted ? "dabei" : "will ich auch"}</span>
        </button>
      </form>
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <div className="wish-head">
          <h3>{w.title}</h3>
          {w.status !== "open" && <span className={`status-pill ${w.status === "planned" ? "published" : w.status === "hidden" ? "rejected" : ""}`}>{STATUS[w.status]}</span>}
        </div>
        {w.details && <p className="muted" style={{ whiteSpace: "pre-line" }}>{w.details}</p>}
        {w.coach_note && <p className="coach-note">{w.coach_note}</p>}
        <span className="faint">
          {w.anonymous && !isCoach ? "anonym" : w.author ?? "gelöschtes Konto"}{w.anonymous && isCoach ? " (für die anderen anonym)" : ""} · {w.created}
          {w.mine && " · von dir"}
        </span>
        {w.mine && !isCoach && (
          <form action={deleteOwnWish}><input type="hidden" name="id" value={w.id} />
            <button className="linkish" type="submit" style={{ padding: 0 }}>Wieder löschen</button></form>
        )}
        {isCoach && (
          <form action={setWishStatus} className="qactions" style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={w.id} />
            <select name="status" defaultValue={w.status} className="select" style={{ width: "auto" }} aria-label="Status">
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="text" name="note" defaultValue={w.coach_note} placeholder="Notiz für alle, z. B. „Kommt in Sitzung 6“" aria-label="Notiz"
              style={{ maxWidth: 320, padding: "7px 10px", fontSize: 14 }} maxLength={200} />
            <button className="btn ghost small" type="submit">Speichern</button>
          </form>
        )}
        {isCoach && (
          <form action={setWishStatus}>
            <input type="hidden" name="id" value={w.id} /><input type="hidden" name="op" value="delete" />
            <button className="linkish" type="submit" style={{ padding: 0 }}>Wunsch löschen</button>
          </form>
        )}
      </div>
    </article>
  );

  return (
    <>
      <Topbar pseudonym={user.pseudonym} home={isCoach ? "/coach" : "/start"} label={isCoach ? "Coach" : "KI-AG"} />
      <main>
        <div className="container page" style={{ gap: 36 }}>
          <section className="welcome">
            <div className="stack" style={{ gap: 14 }}>
              <div className="tags"><span className="tag outline">Themenwünsche</span><span className="tag">{active.length} offen</span></div>
              <h1>Worüber sollen wir sprechen?</h1>
              <p className="lead">
                {isCoach
                  ? "Was sich die Gruppe wünscht, sortiert nach Stimmen. Plan Themen ein und schreib dazu, wann sie drankommen."
                  : "Trag ein, was dich an KI interessiert, und stimm bei den Wünschen der anderen ab. Was viele wollen, kommt in die AG."}
              </p>
            </div>
            {isCoach && groups.length > 1 && (
              <form style={{ display: "flex", gap: 8 }}>
                <select name="ag" defaultValue={groupId ?? undefined} className="select" aria-label="AG wählen">
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="btn ghost small" type="submit">Anzeigen</button>
              </form>
            )}
          </section>

          <div className={isCoach ? "" : "submit-grid"}>
            <section className="stack" style={{ gap: 14 }}>
              {active.length === 0 ? <p className="muted">Noch keine Themenwünsche. {isCoach ? "" : "Mach den Anfang!"}</p> : active.map((w) => <Item w={w} key={w.id} />)}
              {rest.length > 0 && (
                <details className="stack" style={{ gap: 14 }}>
                  <summary className="faint" style={{ cursor: "pointer" }}>Schon besprochen{isCoach ? " oder ausgeblendet" : ""} ({rest.length})</summary>
                  <div className="stack" style={{ gap: 14, marginTop: 14 }}>{rest.map((w) => <Item w={w} key={w.id} />)}</div>
                </details>
              )}
            </section>
            {!isCoach && (
              <section className="card" style={{ position: "sticky", top: 16 }}>
                <header><h3>Neues Thema</h3></header>
                <WishForm />
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
