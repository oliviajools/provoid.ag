import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireCoach } from "@/lib/auth";
import { aiEnabled, emptyCard, type Card } from "@/lib/news";
import { Topbar } from "@/components/Topbar";
import { EditCard } from "./EditCard";

export const metadata: Metadata = { title: "Karte bearbeiten" };
export const dynamic = "force-dynamic";

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const coach = await requireCoach();
  const { id } = await params;
  const { auto } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = (await sql<{ url: string; title: string; source_name: string; card: Card | null; status: string; kid_note: string; finder: string | null; card_by_ai: boolean }[]>`
    select n.url, n.title, n.source_name, n.card, n.status, n.kid_note, n.card_by_ai, u.pseudonym as finder
    from news_items n left join users u on u.id = n.submitted_by where n.id = ${id}`)[0];
  if (!item) notFound();

  return (
    <>
      <Topbar pseudonym={coach.pseudonym} home="/coach" label="Coach" />
      <main>
        <div className="container page" style={{ gap: 28 }}>
          <section className="stack" style={{ gap: 12 }}>
            <p><Link href="/coach/radar">Zurück zur Übersicht</Link></p>
            <div className="tags">
              <span className="tag outline">Karte bearbeiten</span>
              <span className="tag">{item.status === "published" ? "im Radar" : item.status === "hidden" ? "ausgeblendet" : "noch nicht veröffentlicht"}</span>
              {item.card_by_ai && <span className="tag">von KI erstellt</span>}
            </div>
            <h2 style={{ wordBreak: "break-word" }}>{item.title || item.url}</h2>
            <p className="muted"><a href={item.url} target="_blank" rel="noreferrer">Original öffnen</a>{item.finder && <> · eingereicht von <b>{item.finder}</b>: „{item.kid_note}“</>}</p>
          </section>
          <EditCard id={id} card={item.card ?? emptyCard(item.title)} source={item.source_name} ai={aiEnabled()} auto={auto === "1" && !item.card} />
        </div>
      </main>
    </>
  );
}
